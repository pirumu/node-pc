import { WeightCalculatedEvent } from '@common/business/events';
import { EVENT_TYPE } from '@common/constants';
import { LOADCELL_STATUS, LoadcellEntity, PORT_STATUS, PortEntity, Synchronization } from '@dals/mongo/entities';
import { PublisherService, Transport } from '@framework/publisher';
import { EntityManager, ObjectId, Reference } from '@mikro-orm/mongodb';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

@Injectable()
export class BatchLoadcellService implements OnModuleInit, OnModuleDestroy {
  private readonly _logger = new Logger(BatchLoadcellService.name);

  private _eventBuffer = new Map<number, WeightCalculatedEvent>();

  private _batchProcessorInterval: NodeJS.Timeout;
  private readonly _batchIntervalMs = 1000;
  private _isProcessing = false;

  constructor(
    private readonly _em: EntityManager,
    private readonly _publisher: PublisherService,
  ) {}

  public onModuleInit(): void {
    this._logger.log(`Starting Loadcell Batch Processor. Interval: ${this._batchIntervalMs}ms.`);
    this._batchProcessorInterval = setInterval(() => this._triggerBatchProcess(), this._batchIntervalMs);
  }

  public onModuleDestroy(): void {
    this._logger.log('Stopping Loadcell Batch Processor.');
    clearInterval(this._batchProcessorInterval);
    if (this._eventBuffer.size > 0) {
      this._logger.log(`Processing final batch of ${this._eventBuffer.size} events before shutdown.`);
      this._triggerBatchProcess();
    }
  }

  public async flushBufferFor(hardwareIds: number[]): Promise<void> {
    if (hardwareIds.length === 0) {
      return;
    }
    this._logger.log(`Forced flush requested for ${hardwareIds.length} hardwareId(s).`);
    const payloadsToProcess: WeightCalculatedEvent[] = [];
    for (const id of hardwareIds) {
      if (this._eventBuffer.has(id)) {
        payloadsToProcess.push(this._eventBuffer.get(id)!);
        this._eventBuffer.delete(id);
      }
    }
    if (payloadsToProcess.length === 0) {
      this._logger.log('No pending events in buffer for the requested hardwareIds.');
      return;
    }
    await this._processBatch(payloadsToProcess);
    this._logger.log(`Forced flush completed for ${payloadsToProcess.length} event(s).`);
  }

  public async commitPendingChange(hardwareIds: number[]): Promise<void> {
    if (hardwareIds.length === 0) {
      return;
    }
    this._logger.log(`Commit pending change for ${hardwareIds.length} hardwareId(s).`);

    const em = this._em.fork();

    const existingLoadcells = await em.find(LoadcellEntity, { hardwareId: { $in: hardwareIds } }, { populate: ['bin.state'] });
    const loadcells = existingLoadcells.filter((l) => l.liveReading.pendingChange !== 0);
    const bulkOps = loadcells.map((l) => ({
      updateOne: {
        filter: { _id: l._id },
        update: {
          $inc: { availableQuantity: l.liveReading.pendingChange },
          $set: {
            ['synchronization.localToCloud.isSynced']: false,
            ['liveReading.pendingChange']: 0,
          },
        },
      },
    }));
    if (bulkOps.length) {
      const commited = await em.getCollection(LoadcellEntity).bulkWrite(bulkOps);
      this._logger.log(`Commited pending change for ${commited.modifiedCount} hardwareId(s).`);
    } else {
      this._logger.log(`Every pending change is commited.`);
    }
  }

  public onWeighCalculated(payloads: WeightCalculatedEvent[]): void {
    for (const payload of payloads) {
      if (payload.status !== LOADCELL_STATUS.RUNNING && payload.status.toUpperCase() !== LOADCELL_STATUS.RUNNING) {
        continue;
      }
      this._eventBuffer.set(payload.hardwareId, payload);
    }
  }

  private _triggerBatchProcess(): void {
    if (this._isProcessing) {
      this._logger.warn('Skipping batch run: a previous batch is still processing.');
      return;
    }
    if (this._eventBuffer.size === 0) {
      return;
    }

    this._isProcessing = true;

    const batchToProcess = Array.from(this._eventBuffer.values());
    this._eventBuffer.clear();

    this._logger.log(`Starting to process a batch of ${batchToProcess.length} unique loadcell events.`);

    this._processBatch(batchToProcess)
      .catch((error) => {
        this._logger.error('A critical error occurred during batch processing. Some events may be lost.', {
          error: error.message,
          stack: error.stack,
        });
      })
      .finally(() => {
        this._isProcessing = false;
      });
  }

  private async _processBatch(payloads: WeightCalculatedEvent[]): Promise<void> {
    const em = this._em.fork();

    const { toCreate, toUpdate } = await this._segregatePayloads(em, payloads);

    if (toCreate.length > 0) {
      await this._provisionNewLoadcells(em, toCreate);
    }

    if (toUpdate.length > 0) {
      await this._updateExistingLoadcells(em, toUpdate);
    }
  }

  private async _segregatePayloads(em: EntityManager, payloads: WeightCalculatedEvent[]) {
    const hardwareIds = payloads.filter((p) => !!p).map((p) => p.hardwareId);
    const existingLoadcells = await em.find(LoadcellEntity, { hardwareId: { $in: hardwareIds } }, { populate: ['bin.state'] });
    const existingIds = new Set(existingLoadcells.map((lc) => lc.hardwareId));
    const loadcellMap = new Map(existingLoadcells.map((lc) => [lc.hardwareId, lc]));

    const toCreate: WeightCalculatedEvent[] = [];
    const toUpdate: { payload: WeightCalculatedEvent; entity: LoadcellEntity }[] = [];

    for (const payload of payloads) {
      if (existingIds.has(payload.hardwareId)) {
        toUpdate.push({ payload, entity: loadcellMap.get(payload.hardwareId)! });
      } else {
        toCreate.push(payload);
      }
    }
    return { toCreate, toUpdate };
  }

  private async _provisionNewLoadcells(em: EntityManager, payloads: WeightCalculatedEvent[]): Promise<void> {
    this._logger.log(`Provisioning ${payloads.length} new loadcell(s).`);
    const portPaths = new Set(payloads.map((p) => p.portPath));
    const portMap = await this._findOrCreatePorts(em, Array.from(portPaths));

    const newLoadcells = payloads.map((payload) => {
      const port = portMap.get(payload.portPath)!;
      return new LoadcellEntity({
        hardwareId: payload.hardwareId,
        port: Reference.create(port),
        code: `RAW-${payload.hardwareId}`,
        label: `LC#${payload.hardwareId}`,
        liveReading: { currentWeight: payload.weight, pendingChange: 0 },
        calibration: {
          zeroWeight: payload.weight,
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
    });

    await em.persistAndFlush(newLoadcells);
  }

  private async _findOrCreatePorts(em: EntityManager, paths: string[]): Promise<Map<string, PortEntity>> {
    const existingPorts = await em.find(PortEntity, { path: { $in: paths } });
    const existingPaths = new Set(existingPorts.map((p) => p.path));
    const portMap = new Map(existingPorts.map((p) => [p.path, p]));

    const newPorts: PortEntity[] = [];
    for (const path of paths) {
      if (!existingPaths.has(path)) {
        const newPort = new PortEntity({ path, name: path, status: PORT_STATUS.CONNECTED });
        newPorts.push(newPort);
        portMap.set(path, newPort);
      }
    }

    if (newPorts.length > 0) {
      await em.persistAndFlush(newPorts);
    }
    return portMap;
  }

  private async _updateExistingLoadcells(
    em: EntityManager,
    updates: { payload: WeightCalculatedEvent; entity: LoadcellEntity }[],
  ): Promise<void> {
    const bulkOps: any[] = [];

    const loadcellIds: ObjectId[] = [];
    for (const { payload, entity } of updates) {
      loadcellIds.push(entity._id);
      const bin = entity.bin?.getEntity();
      const isBinLocked = bin?.state?.isLocked ?? false;

      const updateOp: any = { $set: { ['liveReading.currentWeight']: payload.weight, heartbeat: Date.now() } };

      if (isBinLocked) {
        this._logger.log(`Update locked bin pendingChange`, {
          binId: entity.bin?.id,
          pendingChange: entity.liveReading.pendingChange,
        });
        const pendingChange = entity.liveReading.pendingChange;
        if (pendingChange !== 0) {
          updateOp.$inc = { availableQuantity: pendingChange };
          updateOp.$set['synchronization.localToCloud.isSynced'] = false;
        }
        updateOp.$set['liveReading.pendingChange'] = 0;
      } else {
        if (!entity.state?.isCalibrated) {
          bulkOps.push({
            updateOne: {
              filter: { _id: entity._id },
              update: { $set: { ['liveReading.currentWeight']: payload.weight, heartbeat: Date.now() } },
            },
          });
          continue;
        }

        const { zeroWeight, unitWeight } = entity.calibration;
        const oldWeight = entity.liveReading.currentWeight;
        let changeInQuantity = 0;
        if (unitWeight > 0) {
          const oldNetWeight = oldWeight - zeroWeight;
          const oldCalculatedQuantity = this._calculateRoundedQuantity(oldNetWeight / unitWeight);
          const newNetWeight = payload.weight - zeroWeight;
          const newCalculatedQuantity = this._calculateRoundedQuantity(newNetWeight / unitWeight);
          changeInQuantity = newCalculatedQuantity - oldCalculatedQuantity;
        }

        if (changeInQuantity !== 0) {
          this._logger.log(`Detect pendingChange for loadcell: `, { id: entity.id, change: changeInQuantity });
          updateOp.$inc = { ['liveReading.pendingChange']: changeInQuantity };
          updateOp.$set['synchronization.localToCloud.isSynced'] = false;
        }
      }

      bulkOps.push({ updateOne: { filter: { _id: entity._id }, update: updateOp } });
    }

    if (bulkOps.length > 0) {
      this._logger.debug(`Performing bulk update for ${bulkOps.length} loadcell(s).`);
      await em.getCollection(LoadcellEntity).bulkWrite(bulkOps);
    }
    return this._emitChanges(em, loadcellIds);
  }

  private _calculateRoundedQuantity(calculatedQuantity: number): number {
    if (!isFinite(calculatedQuantity)) {
      return 0;
    }
    return calculatedQuantity > 0 ? Math.round(calculatedQuantity - 0.3) : Math.round(calculatedQuantity + 0.29);
  }

  private async _emitChanges(em: EntityManager, loadcellIds: ObjectId[]) {
    try {
      const loadcells = await em.find(LoadcellEntity, { _id: { $in: loadcellIds } });
      for (const lc of loadcells) {
        this._publisher
          .publish(
            Transport.MQTT,
            EVENT_TYPE.LOADCELL.QUANTITY_CALCULATED,
            {
              itemId: lc.item?.id,
              loadcellId: lc.id,
              hardwareId: lc.hardwareId,
              changeInQuantity: lc.liveReading.pendingChange,
            },
            {},
            { async: true },
          )
          .catch((e: Error) => {
            Logger.warn('emit quantity calculated error', e, BatchLoadcellService.name);
          });
      }
    } catch (e) {
      Logger.warn('Load loadcells error', e, BatchLoadcellService.name);
    }
  }
}
