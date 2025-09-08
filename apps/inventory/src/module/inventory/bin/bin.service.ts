import { COMMAND_TYPE, EVENT_TYPE } from '@common/constants';
import { PaginatedResult, PaginationMeta } from '@common/dto';
import { CuLockRequest } from '@culock/dto';
import { Command, ProtocolType } from '@culock/protocols';
import { CuResponse } from '@culock/protocols/cu';
import { BinEntity, IssueHistoryEntity, ItemEntity } from '@dals/mongo/entities';
import { AppHttpException } from '@framework/exception';
import { PublisherService, Transport } from '@framework/publisher';
import type { FilterQuery } from '@mikro-orm/core/typings';
import { EntityManager, EntityRepository, ObjectId, Transactional } from '@mikro-orm/mongodb';
import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable, Logger } from '@nestjs/common';

import { OpenCabinetBinRequest } from './dtos/request';

@Injectable()
export class BinService {
  private readonly _maxOpenAttempts = 3;

  private readonly _logger = new Logger(BinService.name);
  constructor(
    private readonly _publisherService: PublisherService,
    private readonly _em: EntityManager,
    @InjectRepository(BinEntity) private readonly _binRepository: EntityRepository<BinEntity>,
  ) {}

  public async getBins(
    page: number,
    limit: number,
    cabinetId?: string,
    siteId?: string,
    enrich?: boolean,
  ): Promise<PaginatedResult<BinEntity>> {
    const conditions: FilterQuery<BinEntity> = {};

    if (cabinetId) {
      conditions.cabinet = new ObjectId(cabinetId);
    }

    if (siteId) {
      conditions.site = new ObjectId(siteId);
    }

    const [binEntities, count] = await this._binRepository.findAndCount(
      { ...conditions },
      {
        limit: limit,
        offset: (page - 1) * limit,
        populate: enrich ? ['site', 'cabinet', 'cluster', 'loadcells', 'loadcells.item'] : [],
      },
    );

    return {
      rows: binEntities,
      meta: new PaginationMeta({
        page,
        limit,
        total: count,
      }),
    };
  }

  public async getBinCompartments(
    page: number,
    limit: number,
    options: {
      cabinetId?: string;
      siteId?: string;
      binId?: string;
    },
  ): Promise<PaginatedResult<any>> {
    const { cabinetId, siteId, binId } = options;
    const conditions: FilterQuery<BinEntity> = cabinetId ? { cabinet: { _id: new ObjectId(cabinetId) } } : {};

    if (siteId) {
      conditions.site = new ObjectId(siteId);
    }

    if (binId) {
      conditions._id = new ObjectId(binId);
    }

    const [bins, total] = await this._em.findAndCount(BinEntity, conditions, {
      populate: ['loadcells', 'loadcells.item', 'items'],
      limit: limit,
      offset: (page - 1) * limit,
      orderBy: { x: 'ASC', y: 'ASC' },
    });

    const now = new Date();

    const rows = bins.map((bin) => {
      let totalQtyOH = 0;
      let totalItems = 0;
      let totalItemLoadcells = 0;
      let hasExpiredItem = false;
      let status = 'good';

      if (bin.type === 'LOADCELL') {
        const loadcells = bin.loadcells.getItems();
        totalQtyOH = loadcells.reduce((sum, lc) => sum + lc.availableQuantity, 0);
        totalItemLoadcells = [...new Set(loadcells.map((l) => l.item?.id))].length;
        hasExpiredItem = loadcells.some((lc) => lc.metadata.expiryDate && lc.metadata.expiryDate.getTime() < now.getTime());
      } else {
        totalQtyOH = bin.items.reduce((sum, item) => sum + item.qty, 0);
        totalItems = [...new Set(bin.items.map((bi) => bi.itemId))].length;
        totalItemLoadcells = 0;
        hasExpiredItem = bin.items.every((item) => item.expiryDate && item.expiryDate.getTime() < now.getTime());
      }

      if (hasExpiredItem) {
        status = 'unavailable';
      } else if (totalQtyOH >= bin.minQty && totalQtyOH <= bin.criticalQty) {
        status = 'low-critical';
      } else if (totalQtyOH > bin.criticalQty && totalQtyOH <= bin.maxQty) {
        status = 'average';
      } else {
        status = 'good';
      }

      return {
        id: bin.id,
        x: bin.x,
        y: bin.y,
        width: bin.width,
        height: bin.height,
        type: bin.type,
        totalQtyOH: totalQtyOH,
        totalItems: totalItems,
        totalItemLoadcells: totalItemLoadcells,
        status: status,
      };
    });

    return {
      rows: rows,
      meta: new PaginationMeta({
        page,
        limit,
        total,
      }),
    };
  }

  public async getCompartmentDetails(id: string): Promise<any> {
    const bin = await this._em.findOne(
      BinEntity,
      { _id: new ObjectId(id) },
      {
        populate: ['loadcells', 'loadcells.item', 'loadcells.item.itemType'],
      },
    );

    if (!bin) {
      throw AppHttpException.badRequest({ message: `Bin with ID ${id} not found.` });
    }

    const allPossibleItemIds =
      bin.type === 'LOADCELL'
        ? bin.loadcells
            .getItems()
            .map((lc) => lc.item?.id)
            .filter((id): id is string => !!id)
        : bin.items.map((i) => i.itemId.toHexString());

    const onLoanHistories = await this._em.find(
      IssueHistoryEntity,
      {
        item: { id: { $in: allPossibleItemIds } },
      },
      { fields: ['item'] },
    );

    const onLoanItemIds = new Set(onLoanHistories.map((h) => h.item.id));

    const detailedItems: any[] = [];
    let totalQtyOH = 0;

    if (bin.type === 'LOADCELL') {
      const loadcells = bin.loadcells.getItems();

      for (const lc of loadcells) {
        if (lc.item?.isInitialized()) {
          const item = lc.item.unwrap();
          const itemType = item.itemType?.unwrap();
          const quantity = lc.availableQuantity;
          const criticalThreshold = lc.metadata.critical;

          let itemStatus: 'good' | 'on-loan' | 'low/critical';
          if (onLoanItemIds.has(item.id)) {
            itemStatus = 'on-loan';
          } else if (quantity > 0 && quantity <= criticalThreshold) {
            itemStatus = 'low/critical';
          } else {
            itemStatus = 'good';
          }

          detailedItems.push({
            itemId: item.id,
            type: bin.type,
            name: item.name,
            partNo: item.partNo,
            itemType: itemType?.name || 'N/A',
            quantity: quantity,
            status: itemStatus,
            materialNo: lc.item.unwrap().materialNo,
            batchNumber: lc.metadata.batchNumber,
            serialNumber: lc.metadata.serialNumber,
            expiryDate: lc.metadata.expiryDate,
            max: lc.metadata.max || 1,
            min: lc.metadata.min || 1,
            critical: lc.metadata.critical || 1,
            isCalibrated: !!lc.metadata.itemId && lc.state.isCalibrated !== undefined && lc.state.isCalibrated,
            calibration: lc.calibration,
            loadcell: lc,
            liveReading: lc.liveReading,
          });
        }
      }
      totalQtyOH = loadcells.reduce((sum, lc) => sum + lc.availableQuantity, 0);
    } else {
      if (bin.items.length > 0) {
        const itemIds = bin.items.map((i) => i.itemId);
        const itemEntities = await this._em.find(ItemEntity, { _id: { $in: itemIds } }, { populate: ['itemType'] });
        const itemMap = new Map(itemEntities.map((e) => [e.id, e]));

        for (const binItem of bin.items) {
          const itemEntity = itemMap.get(binItem.itemId.toHexString());
          if (itemEntity) {
            const itemType = itemEntity.itemType?.unwrap();
            const quantity = binItem.qty;
            const criticalThreshold = binItem.critical;

            let itemStatus: 'good' | 'on-loan' | 'low/critical';
            if (onLoanItemIds.has(itemEntity.id)) {
              itemStatus = 'on-loan';
            } else if (quantity > 0 && quantity <= criticalThreshold) {
              itemStatus = 'low/critical';
            } else {
              itemStatus = 'good';
            }

            detailedItems.push({
              itemId: itemEntity.id,
              type: bin.type,
              name: itemEntity.name,
              materialNo: itemEntity.materialNo,
              partNo: itemEntity.partNo,
              itemType: itemType?.name || 'N/A',
              quantity: quantity,
              status: itemStatus,
              batchNumber: binItem.batchNumber,
              serialNumber: binItem.serialNumber,
              expiryDate: binItem.expiryDate,
              max: binItem.max || 1,
              min: binItem.min || 1,
              critical: binItem.critical || 1,
              isCalibrated: true,
            });
          }
        }
      }
      totalQtyOH = bin.items.reduce((sum, item) => sum + item.qty, 0);
    }

    let binStatus: 'good' | 'on-loan' | 'low/critical';
    if (onLoanItemIds.size > 0) {
      binStatus = 'on-loan';
    } else if (totalQtyOH > 0 && totalQtyOH <= bin.criticalQty) {
      binStatus = 'low/critical';
    } else {
      binStatus = 'good';
    }

    return {
      id: bin.id,
      x: bin.x,
      y: bin.y,
      width: bin.width,
      height: bin.height,
      type: bin.type,

      status: binStatus,
      totalQtyOH: totalQtyOH,

      items: detailedItems,
    };
  }

  public async getBinById(id: string, enrich?: boolean): Promise<BinEntity> {
    const binEntity = await this._binRepository.findOne(
      {
        _id: new ObjectId(id),
      },
      {
        populate: enrich ? ['cabinet', 'site', 'cluster', 'loadcells', 'loadcells.item', 'loadcells.item.itemType'] : [],
      },
    );

    if (!binEntity) {
      throw AppHttpException.badRequest({
        message: `Bin with ${id} not found`,
        data: { binId: id },
      });
    }
    return binEntity;
  }

  public async open(id: string): Promise<boolean> {
    const binEntity = await this.getBinById(id);
    const payload = new CuLockRequest({
      command: Command.OPEN_LOCK,
      protocol: ProtocolType.CU,
      deviceId: binEntity.cuLockId,
      lockIds: [binEntity.lockId],
    });
    this._logger.log('Sending lock open request', payload);
    try {
      const cuLockOpenResponse = await this._publisherService.publish<CuResponse>(Transport.TCP, EVENT_TYPE.LOCK.OPEN, payload);

      if (this._isFailOpenCU(cuLockOpenResponse)) {
        await this._handleFailOpenAndThrowException({
          binEntity,
          payload,
          cuLockOpenResponse,
        });
      }
      this._logger.log(`Successfully open lock`, {
        cuLockId: binEntity.cuLockId,
      });

      await this._publisherService.publish(Transport.MQTT, EVENT_TYPE.LOADCELL.START_READING, {
        bindId: binEntity.id,
        ...payload,
      });

      return this._updateSuccessOpenStatus(binEntity);
    } catch (error) {
      throw error;
    }
  }

  public async openCabinetBins(dto: OpenCabinetBinRequest): Promise<boolean> {
    const binEntities = await this._binRepository.findAll({
      where: {
        cabinet: {
          _id: new ObjectId(dto.cabinetId),
        },
        state: {
          isLocked: true,
        },
      },
    });
    if (binEntities.length === 0) {
      throw AppHttpException.badRequest({
        message: `No bin exists with cabinet id: ${dto.cabinetId}`,
        data: {
          cabinetId: dto.cabinetId,
        },
      });
    }

    const payloads = binEntities.map(
      (binEntity) =>
        new CuLockRequest({
          command: Command.OPEN_LOCK,
          protocol: ProtocolType.CU,
          deviceId: binEntity.cuLockId,
          lockIds: [binEntity.lockId],
        }),
    );

    const cuLockOpenResponses = await Promise.allSettled(
      payloads.map(
        async (payload): Promise<CuResponse> => this._publisherService.publish<CuResponse>(Transport.TCP, EVENT_TYPE.LOCK.OPEN, payload),
      ),
    );

    const cuLockSuccessOpenResponses = cuLockOpenResponses.filter((res) => res.status === 'fulfilled');

    const entitiesShouldUpdate: BinEntity[] = [];

    for (const cuLockOpenResponse of cuLockSuccessOpenResponses) {
      const { value: response } = cuLockOpenResponse;
      if (!this._isFailOpenCU(response)) {
        const entity = binEntities.find((bind) => bind.cuLockId === response.deviceId);
        if (entity) {
          entity.markAlive();
          entitiesShouldUpdate.push(entity);
        }
      }
    }
    if (entitiesShouldUpdate.length === 0) {
      return false;
    }
    const result = await this._binRepository.upsertMany(entitiesShouldUpdate);
    return result.length === entitiesShouldUpdate.length;
  }

  private _isFailOpenCU(response: CuResponse): boolean {
    return !response.isSuccess || !response?.lockStatuses || Object.keys(response).length === 0;
  }

  private async _handleFailOpenAndThrowException(data: {
    binEntity: BinEntity;
    cuLockOpenResponse: CuResponse;
    payload: CuLockRequest;
  }): Promise<void> {
    const { binEntity, cuLockOpenResponse, payload } = data;
    await this._updateFailOpenStatus(binEntity);
    throw AppHttpException.internalServerError({
      message: `Failed to open lock. Please verify the ${payload.protocol} lock protocol.`,
      data: {
        request: payload,
        response: cuLockOpenResponse,
      },
    });
  }

  private async _updateFailOpenStatus(bin: BinEntity): Promise<void> {
    bin.incrementOpenFailedAttempt();
    if (bin.hasExceededFailedAttempts(this._maxOpenAttempts)) {
      bin.markFailed();
    }
    await this._binRepository.nativeUpdate(
      {
        _id: bin._id,
      },
      bin,
    );
  }

  @Transactional()
  private async _updateSuccessOpenStatus(bin: BinEntity): Promise<boolean> {
    bin.markAlive();

    for (const loadcells of bin.loadcells) {
      loadcells.state.isUpdatedWeight = false;
    }

    const result = await this._binRepository.nativeUpdate(
      {
        _id: bin._id,
      },
      bin,
    );
    return result > 0;
  }

  public async activate(id: string): Promise<boolean> {
    const binEntity = await this.getBinById(id);
    binEntity.activate();
    const result = await this._binRepository.nativeUpdate(
      {
        _id: binEntity._id,
      },
      binEntity,
    );

    return result > 0;
  }

  public async deactivate(id: string): Promise<boolean> {
    const binEntity = await this.getBinById(id);
    binEntity.deactivate();
    const result = await this._binRepository.nativeUpdate(
      {
        _id: binEntity._id,
      },
      binEntity,
    );

    return result > 0;
  }
}
