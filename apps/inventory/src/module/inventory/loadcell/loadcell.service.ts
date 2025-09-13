import { EVENT_TYPE } from '@common/constants';
import { PaginatedResult, PaginationMeta } from '@common/dto';
import { LoadcellEntity, LoadcellMetadata, BinState, LoadcellState, CalibrationData, LiveReading } from '@dals/mongo/entities';
import { AppHttpException } from '@framework/exception';
import { PublisherService, Transport } from '@framework/publisher';
import { EntityManager, EntityRepository, FindOptions, ObjectId, Reference } from '@mikro-orm/mongodb';
import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable } from '@nestjs/common';

import { CalibrateLoadcellRequest, GetLoadCellsRequest } from './dtos/request';

@Injectable()
export class LoadcellService {
  constructor(
    private readonly _publisherService: PublisherService,
    private readonly _em: EntityManager,
    @InjectRepository(LoadcellEntity) private readonly _loadcellRepository: EntityRepository<LoadcellEntity>,
  ) {}

  public async getLoadCells(query: GetLoadCellsRequest): Promise<PaginatedResult<LoadcellEntity>> {
    const { portId, page, limit } = query;
    let where = {};

    if (portId) {
      where = {
        port: {
          _id: new ObjectId(portId),
        },
      };
    }

    const options: FindOptions<LoadcellEntity, keyof LoadcellEntity> = {
      limit: limit,
      offset: (page - 1) * limit,
    };
    const [rows, count] = await this._loadcellRepository.findAndCount(where, options);

    return new PaginatedResult(
      rows,
      new PaginationMeta({
        limit,
        page,
        total: count,
      }),
    );
  }

  public async getLoadCell(id: string): Promise<LoadcellEntity> {
    return this._loadcellRepository.findOneOrFail(new ObjectId(id));
  }

  public async unassign(loadcellId: string, itemId: string): Promise<boolean> {
    const loadcellToDecommission = await this._em.findOne(
      LoadcellEntity,
      {
        _id: new ObjectId(loadcellId),
        state: { isCalibrated: true },
        item: new ObjectId(itemId),
      },
      { populate: ['item', 'bin', 'port'] },
    );

    if (!loadcellToDecommission) {
      return true;
    }
    if (!loadcellToDecommission.item) {
      throw AppHttpException.internalServerError({
        message: `Data Integrity Error: Calibrated loadcell ${loadcellId} has no item assigned.`,
      });
    }
    if (!loadcellToDecommission.port || !loadcellToDecommission.hardwareId) {
      throw AppHttpException.internalServerError({
        message: `Data Integrity Error: Calibrated loadcell ${loadcellId} is missing hardware information.`,
      });
    }

    const hardwareId = loadcellToDecommission.hardwareId;
    const port = loadcellToDecommission.port.unwrap();

    const data = new CalibrationData();
    data.zeroWeight = loadcellToDecommission.calibration.zeroWeight;
    const newRawLoadcell = new LoadcellEntity({
      hardwareId: hardwareId,
      port: Reference.create(port),
      code: `RAW-${hardwareId}`,
      label: `LC#${hardwareId}`,
      state: new LoadcellState(),
      calibration: data,
      metadata: new LoadcellMetadata(),
      liveReading: new LiveReading(),
    });

    loadcellToDecommission.reset();

    this._em.persist(newRawLoadcell);

    await this._em.flush();
    return true;
  }

  public async activate(id: string): Promise<boolean> {
    const loadcell = await this._loadcellRepository.findOne(new ObjectId(id));
    if (!loadcell) {
      throw AppHttpException.badRequest({ message: `Loadcell ${id} not found` });
    }
    if (loadcell.hardwareId && loadcell.hardwareId !== 0) {
      await this._publisherService.publish(Transport.MQTT, EVENT_TYPE.LOADCELL.START_READING, { hardwareIds: [loadcell.hardwareId] });
    }
    return true;
  }

  /**
   * Calibrates a loadcell for a specific item, ensuring data integrity within a cluster.
   * This process requires the item's data block to already exist on a loadcell within
   * the operational cluster. It can then be moved or swapped to the target loadcell
   * before calibration. The service does not create new item data blocks.
   */
  public async calibrate(loadcellId: string, calibrateData: CalibrateLoadcellRequest): Promise<boolean> {
    const { binId, itemId, zeroWeight, measuredWeight, measuredQuantity } = calibrateData;

    const targetLoadcell = await this._loadcellRepository.findOne(new ObjectId(loadcellId), { populate: ['item', 'bin'] });

    if (!targetLoadcell) {
      throw AppHttpException.badRequest({ message: `Selected Loadcell ${loadcellId} not found.` });
    }

    if (targetLoadcell.state.isCalibrated) {
      if (!targetLoadcell.item?._id.equals(itemId)) {
        // await this._handleSwapLoadcell(targetLoadcell, itemId);

        throw AppHttpException.badRequest({
          message: `Loadcell is already calibrated with item "${targetLoadcell.item?.unwrap().name}". Cannot re-calibrate with a different item.`,
        });
      }

      const netWeight = measuredWeight - zeroWeight;
      const maxQuantity = measuredQuantity;
      const unitWeight = maxQuantity > 0 ? netWeight / maxQuantity : 0;
      const calculatedQuantity = unitWeight > 0 ? Math.max(0, Math.floor(netWeight / unitWeight)) : 0;

      Object.assign(targetLoadcell.calibration, {
        unitWeight: unitWeight,
        zeroWeight: zeroWeight,
        calibratedQuantity: calculatedQuantity,
        calculatedWeight: measuredWeight,
      });
      targetLoadcell.availableQuantity = calculatedQuantity;
      targetLoadcell.state.isUpdatedWeight = true;
    } else {
      const sourceLoadcell = await this._loadcellRepository.findOne(
        { item: new ObjectId(itemId), state: { isCalibrated: false }, bin: new ObjectId(binId) },
        { populate: ['bin'] },
      );

      if (!sourceLoadcell) {
        throw AppHttpException.badRequest({
          message: `Cloud data for item ${itemId} not found or is already part of another calibrated loadcell.`,
        });
      }
      if (!sourceLoadcell.bin) {
        throw AppHttpException.internalServerError({ message: `Cloud data for item ${itemId} is not assigned to a Bin.` });
      }
      if (targetLoadcell.id === sourceLoadcell.id) {
        throw AppHttpException.badRequest({ message: `Cannot merge a cloud-synced loadcell with itself.` });
      }

      sourceLoadcell.code = sourceLoadcell.code || targetLoadcell.code;
      sourceLoadcell.hardwareId = targetLoadcell.hardwareId;
      sourceLoadcell.port = targetLoadcell.port;
      sourceLoadcell.heartbeat = targetLoadcell.heartbeat;

      const metadata = sourceLoadcell.metadata;
      const netWeight = measuredWeight - zeroWeight;
      const maxQuantity = measuredQuantity;
      const unitWeight = maxQuantity > 0 ? netWeight / maxQuantity : 0;
      const calculatedQuantity = unitWeight > 0 ? Math.max(0, Math.floor(netWeight / unitWeight)) : 0;

      if (calculatedQuantity > metadata.max) {
        sourceLoadcell.metadata.max = calculatedQuantity;
      }

      Object.assign(sourceLoadcell.calibration, {
        unitWeight: unitWeight,
        zeroWeight: zeroWeight,
        calibratedQuantity: calculatedQuantity,
        calculatedWeight: measuredWeight,
      });
      Object.assign(sourceLoadcell.state, {
        isUpdatedWeight: true,
        status: 'IDLE',
        isCalibrated: true,
      });
      sourceLoadcell.availableQuantity = calculatedQuantity;

      const bin = sourceLoadcell.bin.unwrap();
      if (!bin.state) {
        bin.state = new BinState();
      }
      bin.state.isLocked = true;
      this._em.remove(targetLoadcell);
    }
    await this._em.flush();
    return true;
  }

  private async _handleSwapLoadcell(targetLoadcell: LoadcellEntity, newItemId: string): Promise<void> {
    const swapLoadcell = await this._loadcellRepository.findOne(new ObjectId(newItemId));

    if (swapLoadcell) {
      targetLoadcell._id = swapLoadcell._id;
      swapLoadcell._id = targetLoadcell._id;
    }
  }
}
