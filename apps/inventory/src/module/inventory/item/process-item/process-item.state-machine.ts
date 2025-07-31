import { Logger } from '@nestjs/common';

import { ProcessEvent, ProcessState } from '../item.constants';

import { ProcessContext } from './type';

export class ProcessItemStateMachine {
  private readonly _logger = new Logger(ProcessItemStateMachine.name);
  private _state: ProcessState = ProcessState.IDLE;
  private readonly _context: ProcessContext;

  constructor(totalItems: number) {
    this._context = {
      isCloseWarningPopup: true,
      isProcessingItem: false,
      isNextRequestItem: false,
      currentItemIndex: 0,
      totalItems,
      skipCurrentBin: false,
    };
  }

  public getState(): ProcessState {
    return this._state;
  }

  public getContext(): ProcessContext {
    return { ...this._context };
  }

  public transition(event: ProcessEvent, updates?: Partial<ProcessContext>): boolean {
    const transitions: Record<ProcessState, Partial<Record<ProcessEvent, ProcessState>>> = {
      [ProcessState.IDLE]: {
        [ProcessEvent.START]: ProcessState.MQTT_CONNECTING,
      },
      [ProcessState.MQTT_CONNECTING]: {
        [ProcessEvent.MQTT_CONNECTED]: ProcessState.READY,
        [ProcessEvent.ERROR_OCCURRED]: ProcessState.ERROR,
      },
      [ProcessState.READY]: {
        [ProcessEvent.PROCESS_ITEM]: ProcessState.OPENING_BIN,
        [ProcessEvent.ALL_ITEMS_PROCESSED]: ProcessState.COMPLETED,
      },
      [ProcessState.OPENING_BIN]: {
        [ProcessEvent.LOCK_OPEN_SUCCESS]: ProcessState.BIN_OPEN,
        [ProcessEvent.LOCK_OPEN_FAIL]: ProcessState.BIN_FAILED,
        [ProcessEvent.ERROR_OCCURRED]: ProcessState.ERROR,
      },
      [ProcessState.BIN_OPEN]: {
        [ProcessEvent.USER_ACTION_COMPLETE]: ProcessState.CLOSING_BIN,
        [ProcessEvent.ERROR_OCCURRED]: ProcessState.ERROR,
      },
      [ProcessState.WAITING_USER_ACTION]: {
        [ProcessEvent.USER_ACTION_COMPLETE]: ProcessState.CLOSING_BIN,
        [ProcessEvent.WARNING_POPUP_CLOSED]: ProcessState.CLOSING_BIN,
      },
      [ProcessState.CLOSING_BIN]: {
        [ProcessEvent.BIN_CLOSED]: ProcessState.UPDATING_TRANSACTION,
        [ProcessEvent.ERROR_OCCURRED]: ProcessState.ERROR,
      },
      [ProcessState.UPDATING_TRANSACTION]: {
        [ProcessEvent.TRANSACTION_UPDATED]: ProcessState.PROCESSING_NEXT,
        [ProcessEvent.ERROR_OCCURRED]: ProcessState.ERROR,
      },
      [ProcessState.PROCESSING_NEXT]: {
        [ProcessEvent.PROCESS_ITEM]: ProcessState.OPENING_BIN,
        [ProcessEvent.ALL_ITEMS_PROCESSED]: ProcessState.COMPLETED,
      },
      [ProcessState.BIN_FAILED]: {
        [ProcessEvent.SKIP_ITEM]: ProcessState.PROCESSING_NEXT,
        [ProcessEvent.LOCK_OPEN_SUCCESS]: ProcessState.BIN_OPEN,
      },
      [ProcessState.ERROR]: {},
      [ProcessState.COMPLETED]: {},
    };

    const nextState = transitions[this._state]?.[event];
    if (nextState) {
      this._logger.log(`State transition: ${this._state} -> ${nextState} (event: ${event})`);
      this._state = nextState;

      // Update context
      if (updates) {
        Object.assign(this._context, updates);
      }

      // Update flags based on state
      this._updateFlags(nextState);

      return true;
    }

    return false;
  }

  private _updateFlags(state: ProcessState): void {
    switch (state) {
      case ProcessState.OPENING_BIN:
      case ProcessState.BIN_OPEN:
        this._context.isProcessingItem = true;
        break;

      case ProcessState.WAITING_USER_ACTION:
        this._context.isCloseWarningPopup = false;
        break;

      case ProcessState.CLOSING_BIN:
        this._context.isCloseWarningPopup = true;
        break;

      case ProcessState.UPDATING_TRANSACTION:
        this._context.isProcessingItem = false;
        break;

      case ProcessState.PROCESSING_NEXT:
        this._context.isNextRequestItem = true;
        break;

      default:
        break;
    }
  }

  // Methods to update flags from MQTT messages
  public updateFromMqttStatus(data: { isProcessingItem?: boolean; isNextRequestItem?: boolean }): void {
    if (data.isProcessingItem !== undefined) {
      this._context.isProcessingItem = data.isProcessingItem;

      // If processing complete and we're waiting, transition
      if (!data.isProcessingItem && this._state === ProcessState.BIN_OPEN) {
        this.transition(ProcessEvent.USER_ACTION_COMPLETE);
      }
    }

    if (data.isNextRequestItem !== undefined) {
      this._context.isNextRequestItem = data.isNextRequestItem;
    }
  }

  public updateFromMqttError(data: { isCloseWarningPopup?: boolean; isNextRequestItem?: boolean }): void {
    if (data.isCloseWarningPopup !== undefined) {
      this._context.isCloseWarningPopup = data.isCloseWarningPopup;
    }

    if (data.isNextRequestItem !== undefined) {
      this._context.isNextRequestItem = data.isNextRequestItem;
    }
  }
}
