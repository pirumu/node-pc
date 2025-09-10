import { WeightCalculatedEvent } from '@common/business/events';
import { LOADCELL_STATUS, LoadcellEntity, LoadcellState, PORT_STATUS, PortEntity, Synchronization } from '@dals/mongo/entities';
import { RefHelper } from '@dals/mongo/helpers';
import { EntityManager, Reference } from '@mikro-orm/mongodb';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class LoadcellService {
  private readonly _logger = new Logger(LoadcellService.name);

  constructor(private readonly _em: EntityManager) {}

  /**
   * Main handler to process a batch of payloads.
   * It iterates through payloads and delegate processing, ensuring one failure does not stop others.
   */
  public async onWeighCalculated(payloads: WeightCalculatedEvent[]): Promise<LoadcellEntity[]> {
    const results = await Promise.allSettled(payloads.map(async (payload) => this._processSinglePayload(payload)));

    return results
      .map((result, index) => {
        if (result.status === 'rejected') {
          this._logger.error(
            `Failed to process payload for path ${payloads[index].portPath} and hardwareId ${payloads[index].hardwareId}`,
            {
              reason: result.reason,
            },
          );
          return null;
        }
        return result.value;
      })
      .filter((value) => value !== null);
  }

  private async _processSinglePayload(payload: WeightCalculatedEvent): Promise<LoadcellEntity | null> {
    if (payload.status !== LOADCELL_STATUS.RUNNING && payload.status.toUpperCase() !== LOADCELL_STATUS.RUNNING) {
      Logger.warn('Skipping. Loadcell not running');
      return null;
    }

    try {
      const em = this._em.fork();
      // Part 1: Auto-detect and create the loadcell if it doesn't exist.
      const loadcell = await this._provisionOrGetLoadcell(em, payload);

      // Part 2: Update business logic for the existing loadcell.
      return this._processLoadcellUpdate(em, loadcell, payload.weight);
    } catch (error) {
      Logger.error(`An unexpected error occurred while processing hardwareId ${payload.hardwareId}`, error.stack);
      throw error;
    }
  }

  // =================================================================
  // PART 1: AUTO-DETECT AND CREATE (PROVISIONING)
  // =================================================================

  private async _provisionOrGetLoadcell(em: EntityManager, payload: WeightCalculatedEvent): Promise<LoadcellEntity> {
    const { hardwareId, portPath } = payload;
    const loadcell = await em.findOne(LoadcellEntity, { hardwareId }, { populate: ['port'] });

    if (loadcell) {
      let port = RefHelper.get(loadcell.port);

      if (!port || port.path !== portPath) {
        port = await this._findOrCreatePort(em, portPath);
      }

      port.heartbeat = Date.now();
      port.status = PORT_STATUS.CONNECTED;

      return loadcell;
    }

    Logger.log(`New loadcell detected. Provisioning hardwareId ${hardwareId} on port ${portPath}.`);

    const port = await this._findOrCreatePort(em, portPath);

    const newLoadcell = new LoadcellEntity({
      hardwareId,
      port: Reference.create(port),
      code: `RAW-${hardwareId}`,
      label: `LC#${hardwareId}`,
      liveReading: {
        currentWeight: payload.weight,
        pendingChange: 0,
      },
      calibration: {
        zeroWeight: payload.weight, // add tare weight on register loadcell.
        unitWeight: 0,
        calibratedQuantity: 0,
        calculatedWeight: 0,
        calibrationDue: null,
      },
      state: {
        status: LOADCELL_STATUS.RUNNING,
        isUpdatedWeight: false,
        isCalibrated: false,
        isRunning: true,
      },
      synchronization: new Synchronization(),
    });

    await em.persistAndFlush(newLoadcell);
    return newLoadcell;
  }

  private async _findOrCreatePort(em: EntityManager, path: string): Promise<PortEntity> {
    let port = await em.findOne(PortEntity, { path });
    if (!port) {
      port = new PortEntity({ path, name: path, status: PORT_STATUS.CONNECTED });
    }
    port.heartbeat = Date.now();
    port.status = PORT_STATUS.CONNECTED;
    em.persist(port);
    return port;
  }

  // =================================================================
  // PART 2: BUSINESS LOGIC UPDATE (PROCESSING)
  // =================================================================

  private async _processLoadcellUpdate(em: EntityManager, loadcell: LoadcellEntity, newWeight: number): Promise<LoadcellEntity> {
    await em.refresh(loadcell);

    loadcell.heartbeat = Date.now();
    if (!loadcell.state) {
      loadcell.state = new LoadcellState();
      loadcell.state.status = LOADCELL_STATUS.RUNNING;
      loadcell.state.isRunning = true;
    }

    if (!loadcell.state.isCalibrated) {
      Logger.warn(`Skipping weight update for uncalibrated loadcell with hardwareId: ${loadcell.hardwareId}`, {
        hardwareId: loadcell.hardwareId,
        newWeight: newWeight,
      });
      loadcell.liveReading.currentWeight = Number(newWeight);
      await em.flush();
      return loadcell;
    }

    // Step 1: Handle initial state: setting the zero-weight for the first time.
    // if (!loadcell.state.isCalibrated && !loadcell.state.isUpdatedWeight) {
    //   Logger.log(`Performing initial zero-weight set for loadcell ${loadcell.id}.`);
    //   loadcell.calibration.zeroWeight = Number(newWeight);
    //   loadcell.liveReading.currentWeight = Number(newWeight);
    //   loadcell.state.isUpdatedWeight = true;
    //   await em.flush();
    //   return loadcell;
    // }

    // Step 2: Check if the associated Bin is locked. This dictates the entire logic flow.
    await em.populate(loadcell, ['bin']); // Ensure bin.state is loaded
    const bin = RefHelper.getRequired(loadcell.bin, 'BinEntity');
    if (bin.state.isLocked) {
      return this._handleLockedBinUpdate(em, loadcell, newWeight);
    }

    // Step 3: Main Logic for Unlocked Bins.
    const { zeroWeight, unitWeight } = loadcell.calibration;
    const oldWeight = loadcell.liveReading.currentWeight;
    let changeInQuantity = 0;
    if (unitWeight > 0) {
      // Calculate quantities "on-the-fly" without storing them.
      const oldNetWeight = oldWeight - zeroWeight;
      const oldCalculatedQuantity = this._calculateRoundedQuantity(oldNetWeight / unitWeight);
      const newNetWeight = Number(newWeight) - zeroWeight;
      const newCalculatedQuantity = this._calculateRoundedQuantity(newNetWeight / unitWeight);

      changeInQuantity = newCalculatedQuantity - oldCalculatedQuantity;
    }

    // Step 4: Update the persistent liveReading object with the latest data.
    if (changeInQuantity !== 0) {
      loadcell.liveReading.currentWeight = Number(newWeight);
      loadcell.liveReading.pendingChange += changeInQuantity;
      if (!loadcell.synchronization) {
        loadcell.synchronization = new Synchronization();
      }
      loadcell.synchronization.localToCloud.isSynced = false;
      Logger.log(
        `Detected change of ${changeInQuantity} for loadcell ${loadcell.id}. Pending change is now ${loadcell.liveReading.pendingChange}.`,
      );
    }

    await em.flush();
    return loadcell;
  }

  /**
   * Handles the specific update logic when a bin is locked.
   * This "commits" the pending changes to the official `calibration.quantity`.
   */
  private async _handleLockedBinUpdate(em: EntityManager, loadcell: LoadcellEntity, newWeight: number): Promise<LoadcellEntity> {
    Logger.log(`Handling update for LOCKED bin associated with loadcell ${loadcell.id}.`);
    const pendingChange = loadcell.liveReading.pendingChange;

    if (pendingChange !== 0) {
      loadcell.availableQuantity += pendingChange;
      loadcell.synchronization.localToCloud.isSynced = false;
    }

    loadcell.liveReading.pendingChange = 0;
    loadcell.liveReading.currentWeight = Number(newWeight);

    await em.flush();
    return loadcell;
  }

  /**
   * A helper function to encapsulate the specific rounding logic from the original system.
   * This creates an asymmetric dead-zone to prevent minor fluctuations from being registered as changes.
   * @param calculatedQuantity The raw calculated quantity (a float).
   * @returns The rounded quantity according to the specific business rule.
   */
  private _calculateRoundedQuantity(calculatedQuantity: number): number {
    if (!isFinite(calculatedQuantity)) {
      return 0;
    }
    return calculatedQuantity > 0 ? Math.round(calculatedQuantity - 0.3) : Math.round(calculatedQuantity + 0.29);
  }
}
