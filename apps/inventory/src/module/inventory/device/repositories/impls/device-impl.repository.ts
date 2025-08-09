import { PipelineStageBuilder } from '@dals/mongo';
import { BinMRepository, DeviceMRepository, PortMRepository } from '@dals/mongo/repositories';
import { Device } from '@dals/mongo/schema/device.schema';
import { DeviceEntity, DevicePortEntity, PortDeviceEntity } from '@entity';
import { DeviceMapper } from '@mapper';

import { IDeviceRepository } from '../device.repository';
import { Injectable } from '@nestjs/common';

@Injectable()
export class DeviceImplRepository implements IDeviceRepository {
  constructor(
    private readonly _portRepository: PortMRepository,
    private readonly _binRepository: BinMRepository,
    private readonly _repository: DeviceMRepository,
  ) {}

  public async findAllByBinIdAndItemId(filter: { binId: string; itemId: string }): Promise<DeviceEntity[]> {
    const { binId, itemId } = filter;
    const results = await this._repository.findMany({ binId, itemId });
    return DeviceMapper.toEntities(results);
  }

  public async findAll(filters: { portId?: string }): Promise<DeviceEntity[]> {
    const { portId } = filters;
    const results = await this._repository.findMany(portId ? { portId } : {});
    return DeviceMapper.toEntities(results);
  }

  public async findById(id: string): Promise<DeviceEntity | null> {
    const result = await this._repository.findById(id);

    return DeviceMapper.toEntity(result);
  }
  public async findByDeviceNumId(id: number): Promise<DeviceEntity | null> {
    const result = await this._repository.findFirst({ deviceNumId: id });

    return DeviceMapper.toEntity(result);
  }

  public async create(data: DeviceEntity): Promise<DeviceEntity | null> {
    const document = DeviceMapper.toModel(data);
    const result = await this._repository.create(document);
    return DeviceMapper.toEntity(result);
  }

  public async update(id: string, data: DeviceEntity): Promise<DeviceEntity | null> {
    const document = DeviceMapper.toModel(data);
    const result = await this._repository.findByIdAndUpdate(id, document);
    return DeviceMapper.toEntity(result);
  }

  public async delete(id: string): Promise<boolean> {
    const result = await this._repository.removeFirst({ _id: id });
    return result.deletedCount > 0;
  }

  public async reset(id: string, binId?: string): Promise<boolean> {
    const promises = [];
    if (binId) {
      promises.push(this._binRepository.findByIdAndUpdate(binId, { isCalibrated: false }));
    }
    promises.push(
      this._repository.findByIdAndUpdate(id, {
        binId: null,
        itemId: null,
        calcQuantity: 0,
        zeroWeight: 0,
        unitWeight: 0,
        calcWeight: 0,
        quantity: 0,
        quantityMinThreshold: 0,
        quantityMaxThreshold: 0,
        description: {},
      }),
    );
    const [_bin, device] = await Promise.all(promises);
    return Object.keys(device?.description || {}).length === 0;
  }

  public async replaceDeviceId(id: string, portId: string, newDeviceNumId: number): Promise<void> {
    throw new Error('Method not implemented.');
  }

  public async findPortDevices(id?: string): Promise<PortDeviceEntity[]> {
    const pipeline: PipelineStageBuilder[] = [];
    if (id) {
      pipeline.push({
        $match: {
          _id: id,
        },
      });
    }
    pipeline.push(
      {
        $lookup: {
          from: 'devices',
          localField: '_id',
          foreignField: 'portId',
          as: 'devices',
        },
      },
      {
        $lookup: {
          from: 'bins',
          localField: 'devices.binId',
          foreignField: '_id',
          as: 'bins',
        },
      },
      {
        $addFields: {
          devices: {
            $map: {
              input: '$devices',
              as: 'device',
              in: {
                $mergeObjects: [
                  {
                    id: '$$device._id',
                    deviceId: '$$device.deviceId',
                  },
                  {
                    isLinkLoadcell: {
                      $cond: {
                        if: { $ne: ['$$device.binId', null] },
                        then: true,
                        else: false,
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },
      {
        $addFields: {
          devices: {
            $sortArray: {
              input: '$devices',
              sortBy: { deviceId: 1 },
            },
          },
        },
      },
      {
        $project: {
          id: '$_id',
          name: 1,
          path: 1,
          status: 1,
          devices: 1,
          _id: 0,
        },
      },
      {
        $sort: { name: 1 },
      },
    );

    const ports = await this._portRepository.aggregate<{
      id: any;
      name: string;
      path: string;
      status: string;
      devices: Device[];
    }>(pipeline);

    return ports.map((port) => {
      return new PortDeviceEntity({
        id: port.id.toString(),
        name: port.name,
        path: port.path,
        status: port.status,
        devices: DeviceMapper.toEntities(port.devices),
      });
    });
  }
}
