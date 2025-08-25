
export enum TransactionStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  COMPLETED_WITH_ERROR = 'COMPLETED_WITH_ERROR',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  AWAITING_CORRECTION = 'AWAITING_CORRECTION', // Added for error recovery
}

// Add to TransactionService class
export class ExecutionService {
  // ... existing code ...

  /**
   * Resume transaction from AWAITING_CORRECTION state
   * Equivalent to JS logic: continue after user fixes error
   */
  @CreateRequestContext()
  public async resumeTransaction(transactionId: string): Promise<void> {
    const tx = await this._em.findOneOrFail(TransactionEntity, { id: transactionId });

    if (tx.status !== TransactionStatus.AWAITING_CORRECTION) {
      this._logger.warn(`[${tx.id}] Cannot resume transaction. Status: ${tx.status}`);
      return;
    }

    this._logger.log(`[${tx.id}] Resuming transaction from error state.`);

    // Clear error state
    tx.status = TransactionStatus.PROCESSING;
    tx.lastError = undefined;
    await this._em.flush();

    // Re-execute the failed step
    await this._executeStep(tx);
  }

  /**
   * Retry current step with validation
   * Equivalent to JS: check if user fixed the issue, then continue
   */
  @CreateRequestContext()
  public async retryCurrentStep(transactionId: string): Promise<{ canProceed: boolean; errors: string[] }> {
    const tx = await this._em.findOneOrFail(TransactionEntity, { id: transactionId });
    const step = tx.currentStep(tx.currentStepId);

    if (!step) {
      return { canProceed: false, errors: ['Invalid step ID'] };
    }

    this._logger.log(`[${tx.id}] Validating step ${step.stepId} for retry.`);

    // Get current state of all loadcells in the bin
    const loadcells = await this._em.find(LoadcellEntity, {
      bin: new ObjectId(step.binId),
      item: { $ne: null },
    });

    const allPlannedActions = this._getAllPlannedActions(step);
    const validationErrors: string[] = [];

    // Check if user has fixed the errors
    for (const plannedAction of allPlannedActions) {
      const loadcell = loadcells.find((lc) => lc.id === plannedAction.item.loadcellId);
      if (!loadcell) {
        validationErrors.push(`Loadcell for item ${plannedAction.item.itemId} not found.`);
        continue;
      }

      const currentQty = this._calculateCurrentQuantityFromWeight(loadcell);
      const changedQty = currentQty - plannedAction.item.currentQty;

      const validationError = this._validateChange(changedQty, plannedAction);
      if (validationError) {
        validationErrors.push(validationError);
      }
    }

    const canProceed = validationErrors.length === 0;

    if (canProceed) {
      this._logger.log(`[${tx.id}] Step validation passed. Ready to proceed.`);

      // Auto-resume if validation passes
      await this.resumeTransaction(transactionId);
    } else {
      this._logger.warn(`[${tx.id}] Step validation failed. Errors: ${validationErrors.join(', ')}`);

      // Publish validation errors for user feedback
      await this._publisher.publish(Transport.MQTT, this._getErrorTopic(tx.type), {
        transactionId,
        stepId: step.stepId,
        errors: validationErrors,
        canRetry: true,
      });
    }

    return { canProceed, errors: validationErrors };
  }

  /**
   * Skip current step and move to next
   * Equivalent to JS: user decides to skip failed item and continue
   */
  @CreateRequestContext()
  public async skipCurrentStep(transactionId: string, reason: string): Promise<void> {
    const tx = await this._em.findOneOrFail(TransactionEntity, { id: transactionId });

    if (tx.status !== TransactionStatus.AWAITING_CORRECTION) {
      this._logger.warn(`[${tx.id}] Cannot skip step. Status: ${tx.status}`);
      return;
    }

    this._logger.log(`[${tx.id}] Skipping step ${tx.currentStepId}. Reason: ${reason}`);

    // Log the skip event
    const step = tx.currentStep(tx.currentStepId);
    if (step) {
      await this._publisher.publish(Transport.MQTT, EVENT_TYPE.PROCESS.STEP_SKIPPED, {
        transactionId,
        stepId: step.stepId,
        reason,
      });
    }

    // Clear error state and move to next step
    tx.status = TransactionStatus.PROCESSING;
    tx.lastError = undefined;
    await this._em.flush();

    // Advance to next step
    await this._advanceToNextStep(tx, tx.currentStepId);
  }

  /**
   * Check if transaction can be corrected
   * Equivalent to JS: isNextRequestItem logic
   */
  public async canCorrectTransaction(transactionId: string): Promise<boolean> {
    const tx = await this._em.findOneOrFail(TransactionEntity, { id: transactionId });

    if (tx.status !== TransactionStatus.AWAITING_CORRECTION) {
      return false;
    }

    const step = tx.currentStep(tx.currentStepId);
    if (!step) {
      return false;
    }

    // Check if bin is still accessible
    const bin = await this._em.findOne(BinEntity, { id: step.binId });
    return bin && !bin.state.isFailed && !bin.state.isLocked;
  }

  // Enhanced handleStepFail with retry capability
  @OnEvent(EVENT_TYPE.PROCESS.STEP_FAIL)
  @CreateRequestContext()
  public async handleStepFail(payload: {
    transactionId: string;
    stepId: string;
    errors: string[];
    allowRetry?: boolean;
  }): Promise<void> {
    const tx = await this._em.findOneOrFail(TransactionEntity, { id: payload.transactionId });
    this._logger.error(`[${tx.id}] Step ${payload.stepId} failed. Errors: ${payload.errors.join(', ')}`);

    tx.status = TransactionStatus.AWAITING_CORRECTION;
    tx.lastError = {
      stepId: payload.stepId,
      messages: payload.errors,
      allowRetry: payload.allowRetry !== false, // Default to true
      timestamp: new Date(),
    };
    await this._em.flush();

    // Publish error with retry option
    await this._publisher.publish(Transport.MQTT, this._getErrorTopic(tx.type), {
      transactionId: tx.id,
      stepId: payload.stepId,
      errors: payload.errors,
      canRetry: payload.allowRetry !== false,
      actions: ['retry', 'skip', 'cancel'], // Available user actions
    });
  }

  // Add helper method for getAllPlannedActions (if not exists)
  private _getAllPlannedActions(step: ExecutionStep) {
    return [
      ...step.itemsToIssue.map((item) => ({ type: PlanActionType.ISSUE, item })),
      ...step.itemsToReturn.map((item) => ({ type: PlanActionType.RETURN, item })),
      ...step.itemsToReplenish.map((item) => ({ type: PlanActionType.REPLENISH, item })),
      ...step.keepTrackItems.map((item) => ({
        type: PlanActionType.KEEP_TRACK,
        item: { ...item, requestQty: 0 },
      })),
    ];
  }
}

// Add new event handlers for user actions
@OnEvent(EVENT_TYPE.PROCESS.USER_RETRY_STEP)
@CreateRequestContext()
public async handleUserRetryStep(payload: { transactionId: string }): Promise<void> {
  await this.retryCurrentStep(payload.transactionId);
}

@OnEvent(EVENT_TYPE.PROCESS.USER_SKIP_STEP)
@CreateRequestContext()
public async handleUserSkipStep(payload: { transactionId: string; reason: string }): Promise<void> {
  await this.skipCurrentStep(payload.transactionId, payload.reason);
}

@OnEvent(EVENT_TYPE.PROCESS.USER_CANCEL_TRANSACTION)
@CreateRequestContext()
public async handleUserCancelTransaction(payload: { transactionId: string; reason: string }): Promise<void> {
  const tx = await this._em.findOneOrFail(TransactionEntity, { id: payload.transactionId });
  tx.status = TransactionStatus.CANCELLED;
  tx.lastError = { message: payload.reason, timestamp: new Date() };
  await this._em.flush();

  await this._publisher.publish(Transport.MQTT, EVENT_TYPE.PROCESS.TRANSACTION_CANCELLED, {
    transactionId: payload.transactionId,
    reason: payload.reason,
  });
}

// Add these to EVENT_TYPE constants
export const EVENT_TYPE = {
  PROCESS: {
    // ... existing events ...
    STEP_SKIPPED: 'process.step.skipped',
    USER_RETRY_STEP: 'process.user.retry_step',
    USER_SKIP_STEP: 'process.user.skip_step',
    USER_CANCEL_TRANSACTION: 'process.user.cancel_transaction',
    TRANSACTION_CANCELLED: 'process.transaction.cancelled',
  }
};
