import { COMMAND_TYPE, EVENT_TYPE } from '@common/constants';
import { CuLockRequest } from '@culock/dto';
import { Command, ProtocolType } from '@culock/protocols';
import { CuResponse } from '@culock/protocols/cu';
import { BinEntity } from '@entity';
import { Transactional } from '@framework/decorators/database';
import { AppHttpException } from '@framework/exception';
import { PublisherService, Transport } from '@framework/publisher';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { OpenAllBinRequest } from './dtos/request';
import { BIN_REPOSITORY_TOKEN, IBinRepository } from './repositories';

@Injectable()
export class BinService {
  private readonly _maxOpenAttempts = 3;

  private readonly _logger = new Logger(BinService.name);
  constructor(
    private readonly _publisherService: PublisherService,
    @Inject(BIN_REPOSITORY_TOKEN) private readonly _repository: IBinRepository,
  ) {}

  private async _getBinById(id: string): Promise<BinEntity> {
    const binEntity = await this._repository.findById(id);
    if (!binEntity) {
      throw AppHttpException.badRequest({
        message: `Bin with ${id} not found`,
        data: { binId: id },
      });
    }
    return binEntity;
  }

  public async open(id: string): Promise<boolean> {
    const binEntity = await this._getBinById(id);

    await this._publisherService.publish(Transport.MQTT, EVENT_TYPE.TRACE_CU_LOCK_OPEN, {
      data: {
        request: 'sending',
        binId: binEntity.id,
      },
    });

    const payload = new CuLockRequest({
      command: Command.OPEN_LOCK,
      protocol: ProtocolType.CU,
      deviceId: binEntity.cuId,
      lockIds: [binEntity.lockId],
    });

    this._logger.log('Sending lock open request', payload);

    try {
      const cuLockOpenResponse = await this._publisherService.publish<CuResponse>(Transport.HTTP, COMMAND_TYPE.CU_LOCK_OPEN, payload);

      if (this._isFailOpenCU(cuLockOpenResponse)) {
        await this._handleFailOpenAndThrowException({
          binEntity,
          payload,
          cuLockOpenResponse,
        });
      }
      this._logger.log(`Successfully open lock deviceId=${binEntity.cuId}`);

      await Promise.all([
        this._publisherService.publish(Transport.MQTT, EVENT_TYPE.TRACE_CU_LOCK_OPEN, { request: 'end', status: 'success' }), // trace
        this._publisherService.publish(Transport.MQTT, EVENT_TYPE.BIN_OPENED, {
          bindId: binEntity.id,
          ...payload,
        }), // trigger loadcell process
      ]);

      return this._updateSuccessOpenStatus(binEntity);
    } catch (error) {
      await this._publisherService.publish(Transport.MQTT, EVENT_TYPE.TRACE_CU_LOCK_OPEN, {
        request: 'end',
        status: 'error',
        message: error.message,
      });
      throw error;
    }
  }

  public async openAll(dto: OpenAllBinRequest): Promise<boolean> {
    const binEntities = await this._repository.findAll({
      cabinetId: dto.cabinetId,
      isLocked: true,
    });
    if (binEntities.length === 0) {
      throw AppHttpException.badRequest({
        message: `No bin exists with cabinet id: ${dto.cabinetId}`,
      });
    }

    await this._publisherService.publish(Transport.MQTT, EVENT_TYPE.TRACE_CU_LOCK_OPEN, {
      data: {
        request: 'sending',
        binIds: binEntities.map((bin) => bin.id),
      },
    });

    const payloads = binEntities.map(
      (binEntity) =>
        new CuLockRequest({
          command: Command.OPEN_LOCK,
          protocol: ProtocolType.CU,
          deviceId: binEntity.cuId,
          lockIds: [binEntity.lockId],
        }),
    );

    const cuLockOpenResponses = await Promise.allSettled(
      payloads.map(
        async (payload): Promise<CuResponse> =>
          this._publisherService.publish<CuResponse>(Transport.HTTP, COMMAND_TYPE.CU_LOCK_OPEN, payload),
      ),
    );

    const cuLockSuccessOpenResponses = cuLockOpenResponses.filter((res) => res.status === 'fulfilled');

    const entitiesShouldUpdate: BinEntity[] = [];

    for (const cuLockOpenResponse of cuLockSuccessOpenResponses) {
      const { value: response } = cuLockOpenResponse;
      if (!this._isFailOpenCU(response)) {
        const entity = binEntities.find((bind) => bind.cuId === response.deviceId);
        if (entity) {
          entity.markAlive();
          entitiesShouldUpdate.push(entity);
        }
      }
    }
    return entitiesShouldUpdate.length ? this._repository.updateBinsOpenStatus(entitiesShouldUpdate) : false;
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
    bin.incrementFailedAttempt();
    if (bin.hasExceededFailedAttempts(this._maxOpenAttempts)) {
      bin.markFailed();
    }
    await this._repository.updateBinOpenStatus(bin.id, bin);
  }

  @Transactional()
  private async _updateSuccessOpenStatus(bin: BinEntity): Promise<boolean> {
    bin.markAlive();
    return this._repository.updateBinOpenStatus(bin.id, bin, { withDevice: { isUpdateWeight: false } });
  }

  public async activate(id: string): Promise<boolean> {
    const binEntity = await this._getBinById(id);
    binEntity.activate();
    return this._repository.updateBinOpenStatus(binEntity.id, binEntity);
  }

  public async deactivate(id: string): Promise<boolean> {
    const binEntity = await this._getBinById(id);
    binEntity.deactivate();
    return this._repository.updateBinOpenStatus(binEntity.id, binEntity);
  }

  public async confirm(isNextRequestItem: boolean): Promise<boolean> {
    await this._publisherService.publish(Transport.MQTT, EVENT_TYPE.CONFIRM_PROCESS, { isCloseWarningPopup: true, isNextRequestItem });
    return true;
  }

  //
  // public async updateBinAfterSuccessfulOpen(bin: IBin): Promise<IBin> {
  //   const updatedBin: IBin = {
  //     ...bin,
  //     isLocked: 0,
  //     countFailed: 0,
  //   };
  //
  //   // Update devices to reset update weight
  //   await this._deviceService.resetUpdateWeightByBinId(bin._id!);
  //
  //   return await this._repository.save(updatedBin);
  // }
  //
  // public async updateBinAfterFailedOpen(bin: IBin): Promise<IBin> {
  //   const failedCount = BinHelper.calculateFailedCount(bin.countFailed);
  //   const updatedBin: IBin = {
  //     ...bin,
  //     countFailed: failedCount.countFailed,
  //     isFailed: failedCount.isFailed,
  //   };
  //
  //   return await this._repository.save(updatedBin);
  // }
  //
  // public async updateBinAfterReplaceItem(bin: IBin): Promise<IBin> {
  //   const updatedBin: IBin = {
  //     ...bin,
  //     isDamage: 0,
  //     isLocked: 0,
  //     countFailed: 0,
  //   };
  //
  //   // Update devices to reset damage and update weight
  //   await this._deviceService.resetDamageAndUpdateWeightByBinId(bin._id!);
  //
  //   return await this._repository.save(updatedBin);
  // }
  //
  // public async updateBinAfterRemoveItem(bin: IBin): Promise<IBin> {
  //   const updatedBin: IBin = {
  //     ...bin,
  //     isDamage: 0,
  //     isLocked: 0,
  //     countFailed: 0,
  //   };
  //
  //   // Update devices to reset damage and update weight
  //   await this._deviceService.resetDamageAndUpdateWeightByBinId(bin._id!);
  //   // Additional update for remove item - reset update weight again
  //   await this._deviceService.resetUpdateWeightByBinId(bin._id!);
  //
  //   return await this._repository.save(updatedBin);
  // }

  // public async replaceItem(req, res, next) {
  //   try {
  //     mqttClient.publish('cu/openLock', JSON.stringify({ isSendOpenLockMsg: true }));
  //     await wait(500);
  //
  //     const { id } = req.params;
  //
  //     const bin = await Bin.findOne({
  //       where: { id },
  //     });
  //     const httpsAgent = new https.Agent({ rejectUnauthorized: false });
  //     const token = req.ctx_token;
  //     let config = {
  //       method: 'post',
  //       url: 'http://localhost:3000/api/lock/open',
  //       httpsAgent: httpsAgent,
  //       headers: {
  //         Authorization: 'Bearer ' + token,
  //         'Content-Type': 'application/json',
  //       },
  //       data: '',
  //     };
  //     let temp = {
  //       deviceType: deviceType,
  //       deviceId: bin.cu_id,
  //       lockID: [bin.lock_id],
  //     };
  //     config.data = JSON.stringify(temp);
  //
  //     let dt = await axios(config);
  //     mqttClient.publish('cu/openLock', JSON.stringify({ isSendOpenLockMsg: false }));
  //     if (dt.data.results.length) {
  //       await Device.update(
  //         {
  //           damageQuantity: 0,
  //           is_update_weight: 0,
  //         },
  //         {
  //           where: {
  //             binId: bin.id,
  //           },
  //         },
  //       );
  //
  //       bin.is_damage = 0;
  //       bin.is_locked = 0;
  //       bin.count_failed = 0;
  //       await bin.save();
  //       res.send({ success: true, data: null });
  //     } else {
  //       if (bin.count_failed >= 2) {
  //         bin.count_failed = 3;
  //         bin.is_failed = 1;
  //       } else {
  //         bin.count_failed += 1;
  //       }
  //       await bin.save();
  //       mqttClient.publish('bin/openFail', JSON.stringify({ binId: bin.id }));
  //       res.send({ success: false, data: null });
  //     }
  //   } catch (err) {
  //     logger.error('[BinController][replaceItem] get error %s', err);
  //     next(new HttpError(ERRORS.InternalServerError));
  //     return;
  //   }
  // }
}
