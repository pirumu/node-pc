import { COMMAND_TYPE, EVENT_TYPE } from '@common/constants';
import { PaginatedResult, PaginationMeta } from '@common/dto';
import { CuLockRequest } from '@culock/dto';
import { Command, ProtocolType } from '@culock/protocols';
import { CuResponse } from '@culock/protocols/cu';
import { BinEntity } from '@dals/mongo/entities';
import { AppHttpException } from '@framework/exception';
import { PublisherService, Transport } from '@framework/publisher';
import { EntityRepository, ObjectId, Transactional } from '@mikro-orm/mongodb';
import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable, Logger } from '@nestjs/common';

import { OpenCabinetBinRequest } from './dtos/request';
import type { FilterQuery } from '@mikro-orm/core/typings';

@Injectable()
export class BinService {
  private readonly _maxOpenAttempts = 3;

  private readonly _logger = new Logger(BinService.name);
  constructor(
    private readonly _publisherService: PublisherService,
    @InjectRepository(BinEntity) private readonly _binRepository: EntityRepository<BinEntity>,
  ) {}

  public async getBins(page: number, limit: number, cabinetId?: string, enrich?: boolean): Promise<PaginatedResult<BinEntity>> {
    const conditions: FilterQuery<BinEntity> = cabinetId
      ? {
          cabinet: {
            _id: new ObjectId(cabinetId),
          },
        }
      : {};

    const [binEntities, count] = await this._binRepository.findAndCount(
      { ...conditions },
      {
        limit: limit,
        offset: (page - 1) * limit,
        populate: enrich ? ['site', 'cabinet', 'cluster', 'loadcells'] : [],
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
      const cuLockOpenResponse = await this._publisherService.publish<CuResponse>(Transport.TCP, COMMAND_TYPE.CU_LOCK_OPEN, payload);

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

      await this._publisherService.publish(Transport.MQTT, EVENT_TYPE.BIN.OPENED, {
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
        async (payload): Promise<CuResponse> =>
          this._publisherService.publish<CuResponse>(Transport.TCP, COMMAND_TYPE.CU_LOCK_OPEN, payload),
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
