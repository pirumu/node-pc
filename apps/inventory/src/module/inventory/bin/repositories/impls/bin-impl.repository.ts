import { BinMRepository, DeviceMRepository } from '@dals/mongo/repositories';
import { Bin } from '@dals/mongo/schema/bin.schema';
import { Device } from '@dals/mongo/schema/device.schema';
import { BinEntity, DeviceEntity } from '@entity';
import { BinMapper } from '@mapper';
import { Injectable } from '@nestjs/common';
import { AnyBulkWriteOperation } from 'mongoose';

import { IBinRepository } from '../bin.repository';

@Injectable()
export class BinImplRepository implements IBinRepository {
  constructor(
    private readonly _repository: BinMRepository,
    private readonly _deviceRepository: DeviceMRepository,
  ) {}

  public async updateBinOpenStatus(
    id: string,
    entity: Partial<BinEntity>,
    options?: { withDevice: Partial<DeviceEntity> },
  ): Promise<boolean> {
    const promises: Promise<any>[] = [
      this._repository.findByIdAndUpdate(id, {
        isFailed: entity.isFailed,
        countFailed: entity.countFailed,
        isSync: entity.isSync,
        retryCount: entity.retryCount,
      }),
    ];
    if (options && options.withDevice) {
      promises.push(
        this._deviceRepository.updateFirst(
          {
            binId: entity.id,
          },
          {
            isUpdateWeight: options.withDevice || 0,
          },
          {},
        ),
      );
    }
    const docs = await Promise.all(promises);
    return true;
  }
  public async updateBinsOpenStatus(entities: Partial<BinEntity>[], options?: { withDevice: Partial<DeviceEntity> }): Promise<boolean> {
    const binOperations: AnyBulkWriteOperation<Bin>[] = entities.map((entity) => ({
      updateOne: {
        filter: { _id: entity.id },
        update: {
          $set: {
            isFailed: entity.isFailed,
            countFailed: entity.countFailed,
            isSync: entity.isSync,
            retryCount: entity.retryCount,
          },
        },
      },
    }));
    const deviceOperations: AnyBulkWriteOperation<Device>[] = [];
    if (options && options.withDevice) {
      for (const entity of entities) {
        deviceOperations.push({
          updateOne: {
            filter: {
              binId: entity.id,
            },
            update: {
              $set: {
                isUpdateWeight: options.withDevice || 0,
              },
            },
          },
        });
      }
    }

    const promises = [this._repository.bulkWrite(binOperations)];
    if (deviceOperations.length > 0) {
      promises.push(this._deviceRepository.bulkWrite(deviceOperations));
    }
    const docs = await Promise.all(promises);
    return true;
  }

  public async findAll(): Promise<BinEntity[]> {
    const results = await this._repository.findMany({});
    return BinMapper.toEntities(results);
  }

  public async findById(id: string): Promise<BinEntity | null> {
    return null;
    // const result = await this._repository.findOne({ _id: id });
    // if (!result) return null;
    // return BinMapper.toEntity(result);
  }

  public async create(data: Partial<BinEntity>): Promise<BinEntity> {
    return null as any;
    // const document = BinMapper.toDocument(data);
    // const result = await this._repository.create(document);
    // return BinMapper.toEntity(result);
  }

  public async update(id: string, data: Partial<BinEntity>): Promise<BinEntity | null> {
    return null;
    // const document = BinMapper.toDocument(data);
    // const result = await this._repository.findOneAndUpdate({ _id: id }, document, { new: true });
    // if (!result) return null;
    // return BinMapper.toEntity(result);
  }

  public async delete(id: string): Promise<boolean> {
    return false;
    // const result = await this._repository.deleteOne({ _id: id });
    // return result.deletedCount > 0;
  }
}
