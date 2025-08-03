import { DeviceEntity, PortDeviceEntity } from '@entity';
import { Transactional } from '@framework/decorators/database';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';

import { DevicePublisherService } from './device-publisher.service';
import {
  ActiveDevicesRequest,
  AddLabelRequest,
  GetDeviceDetailRequest,
  GetDevicesByAppRequest,
  GetDevicesByPortRequest,
  RemoveLabelRequest,
  UnassignDevicesRequest,
} from './dtos/request';
import { DeviceActivatedEvent } from './events';
import { DEVICE_REPOSITORY_TOKEN, IDeviceRepository } from './repositories';

@Injectable()
export class DeviceService {
  constructor(
    private readonly _devicePublisherService: DevicePublisherService,
    @Inject(DEVICE_REPOSITORY_TOKEN) private readonly _repository: IDeviceRepository,
  ) {}

  // public async update(body: {
  //   id: string;
  //   deviceId: number;
  //   calcWeight: number;
  //   zeroWeight: number;
  //   deviceDescription: {
  //     name: string;
  //   };
  // }) {
  //   const {
  //     id,
  //     deviceId,
  //     zeroWeight,
  //     calcWeight,
  //     deviceDescription: { name },
  //   } = body;
  //
  //   let partNumber, materialNo;
  //
  //   const device = await this._repository.findById(id);
  //   if (!device) {
  //     throw new BadRequestException(`Device id ${id} not found`);
  //   }
  //
  //   try {
  //     let netWeight = calcWeight - zeroWeight;
  //
  //     let dataDeviceUpdated = {
  //       deviceId,
  //       zeroWeight,
  //       calcWeight,
  //     };
  //
  //     let deviceDescriptionData = {
  //       name,
  //     };
  //
  //     const [cabinetName, binRow, binName, itemName, itemPartNo] = deviceDescriptionData.name.split('_');
  //
  //     if (binRow && binName && itemName) {
  //       const cabinet = await Cabinet.findOne({
  //         where: {
  //           name: cabinetName,
  //         },
  //       });
  //
  //       const bin = await Bin.findOne({
  //         where: {
  //           name: binName,
  //           row: binRow,
  //           cabinetId: cabinet.id,
  //         },
  //       });
  //       const item = await Item.findOne({
  //         where: { name: itemName, partNo: itemPartNo },
  //       });
  //
  //       if (item) {
  //         deviceDescriptionData.partNumber = item.part_no;
  //         deviceDescriptionData.materialNo = item.material_no;
  //       }
  //
  //       const binItem = await BinItem.findOne({
  //         where: {
  //           itemId: item.id,
  //           binId: bin.id,
  //         },
  //       });
  //       if (binItem) {
  //         dataDeviceUpdated = {
  //           ...dataDeviceUpdated,
  //           binId: binItem.binId,
  //           itemId: binItem.itemId,
  //           quantity: binItem.max,
  //           calcQuantity: binItem.max,
  //           quantityMinThreshold: binItem.min,
  //           quantityCritThreshold: binItem.critical,
  //           changeqty: 0,
  //           unitWeight: netWeight / binItem.max,
  //           is_sync: 0,
  //         };
  //       }
  //       await bin.update({
  //         is_locked: 1,
  //         is_calibrated: 1,
  //         new_max: 0,
  //         max: bin.new_max > 0 ? bin.new_max : bin.max,
  //       });
  //       //publish topic bin/close to trigger logic loadcell process
  //       mqttClient.publish('bin/close', JSON.stringify({}));
  //     }
  //
  //     await device.update(dataDeviceUpdated, { transaction });
  //
  //     let deviceDescription = await DeviceDescription.findOne({
  //       where: { deviceId: device.id },
  //     });
  //     if (!deviceDescription) {
  //       deviceDescription = await DeviceDescription.create(
  //         {
  //           ...deviceDescriptionData,
  //         },
  //         { transaction },
  //       );
  //     } else {
  //       await deviceDescription.update(
  //         {
  //           ...deviceDescriptionData,
  //         },
  //         { transaction },
  //       );
  //     }
  //     logger.debug('[DeviceController][update] deviceDescription: %s', JSON.stringify(deviceDescription));
  //
  //     const _deviceData = device.get({ plain: true });
  //     const _deviceDescriptionData = deviceDescription.get({
  //       attributes: {
  //         exclude: ['id', 'deviceId', 'updatedAt', 'createdAt'],
  //       },
  //     });
  //
  //     const newUpdates = {
  //       ..._deviceData,
  //       deviceDescription: {
  //         ..._deviceDescriptionData,
  //       },
  //     };
  //
  //     logger.debug('[DeviceController][update] newUpdates: %s', JSON.stringify(newUpdates));
  //
  //     await transaction.commit();
  //
  //     res.send({ success: true });
  //   } catch (error) {
  //     throw new InternalServerErrorException('Can not update device', error);
  //   }
  // }

  public async getDetail(query: GetDeviceDetailRequest): Promise<DeviceEntity | null> {
    const { id } = query;
    return this._repository.findById(id);
  }

  public async getByApp(query: GetDevicesByAppRequest): Promise<DeviceEntity[]> {
    return this._repository.findAll(query);
  }

  public async getByPort(query: GetDevicesByPortRequest): Promise<PortDeviceEntity[]> {
    const { portId } = query;
    return this._repository.findPortDevices(portId);
  }

  public async unassign(data: UnassignDevicesRequest): Promise<boolean> {
    const { id } = data;

    const device = await this._repository.findById(id);
    if (!device) {
      throw new BadRequestException(`Device ${id} not found`);
    }
    return this._unassign(device);
  }

  public async active(dto: ActiveDevicesRequest): Promise<boolean> {
    const { id } = dto;
    const device = await this._repository.findById(id);
    if (!device) {
      throw new BadRequestException(`Device ${id} not found`);
    }
    await this._devicePublisherService.emit(
      new DeviceActivatedEvent({
        deviceId: device.id,
        deviceNumId: device.deviceNumId,
      }),
    );
    return true;
  }

  public async addLabel(dto: AddLabelRequest): Promise<boolean> {
    const { id, label } = dto;
    const entity = await this._repository.update(id, { label });
    return !!entity && entity.label === label;
  }

  public async removeLabel(dto: RemoveLabelRequest): Promise<boolean> {
    const { id } = dto;
    const entity = await this._repository.update(id, { label: null });
    return !!entity && entity.label === null;
  }

  @Transactional()
  private async _unassign(device: DeviceEntity): Promise<boolean> {
    return this._repository.reset(device.id, device.binId);
  }

  public async getDevicesByBinAndItem(binId: string, itemId: string): Promise<DeviceEntity[]> {
    return this._repository.findAllByBinIdAndItemId({ binId, itemId });
  }
}
