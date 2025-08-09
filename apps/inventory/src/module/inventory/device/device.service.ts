import { BinItemMRepository, BinMRepository, CabinetMRepository, ItemMRepository } from '@dals/mongo/repositories';
import { DeviceEntity, DeviceWithPortEntity, PortDeviceEntity } from '@entity';
import { Transactional } from '@framework/decorators/database';
import { AppHttpException } from '@framework/exception';
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
    private readonly _cabinetMRepository: CabinetMRepository,
    private readonly _binMRepository: BinMRepository,
    private readonly _itemMRepository: ItemMRepository,
    private readonly _binItemMRepository: BinItemMRepository,
  ) {}

  public async getDetail(query: GetDeviceDetailRequest): Promise<DeviceEntity | null> {
    const { id } = query;
    return this._repository.findByDeviceNumId(id);
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

  public async update(dto: UpdateDeviceRequest): Promise<boolean> {
    const {
      id,
      deviceId,
      weight,
      zeroWeight,
      calcWeight,
      quantityMinThreshold,
      quantityCritThreshold,
      deviceDescription: {
        name,
        supplierEmail,
        matlGrp,
        criCode,
        jom,
        itemAcct,
        field1,
        // bag1
        expiryBag,
        quantityBag,
        batchNoBag,
        // bag2
        expiryBag2,
        quantityBag2,
        batchNoBag2,
        // bag3
        quantityBag3,
        expiryBag3,
        batchNoBag3,
      },
    } = dto;

    let partNumber: string | undefined, materialNo: string | undefined;

    const device = await this._repository.findByDeviceNumId(id);
    if (!device) {
      throw AppHttpException.badRequest({ message: `Device ${id} not found` });
    }

    const netWeight = calcWeight - zeroWeight;

    const deviceDescriptionData = {
      name,
      partNumber,
      materialNo,
      supplierEmail,
      matlGrp,
      criCode,
      jom,
      itemAcct,
      field1,
      // bag1
      expiryBag,
      quantityBag,
      batchNoBag,
      // bag2
      expiryBag2,
      quantityBag2,
      batchNoBag2,
      // bag3
      quantityBag3,
      expiryBag3,
      batchNoBag3,
    };

    let dataDeviceUpdated: Record<string, any> = {
      deviceNumId: deviceId,
      weight,
      zeroWeight,
      calcWeight,
      quantityMinThreshold,
      quantityCritThreshold,
      description: deviceDescriptionData,
    };

    const [cabinetName, binRow, binName, itemName, itemPartNo] = name.split('_');

    if (binRow && binName && itemName) {
      // Find cabinet
      const cabinet = await this._cabinetMRepository.findFirst(
        {
          name: cabinetName,
        },
        {},
      );

      if (!cabinet) {
        throw AppHttpException.badRequest({ message: `Cabinet ${cabinetName} not found` });
      }

      // Find bin
      const bin = await this._binMRepository.findFirst({
        name: binName,
        row: binRow,
        cabinetId: cabinet._id,
      });

      if (!bin) {
        throw new Error(`Bin ${binName} not found`);
      }

      // Find item
      const item = await this._itemMRepository.findFirst({
        name: itemName,
        partNo: itemPartNo,
      });

      if (item) {
        deviceDescriptionData.partNumber = item.partNo;
        deviceDescriptionData.materialNo = item.materialNo;

        // Find bin item
        const binItem = await this._binItemMRepository.findFirst({
          itemId: item._id,
          binId: bin._id,
        });

        if (binItem) {
          dataDeviceUpdated = {
            ...dataDeviceUpdated,
            binId: binItem.binId,
            itemId: binItem.itemId,
            quantity: binItem.max,
            calcQuantity: binItem.max,
            quantityMinThreshold: binItem.min,
            quantityCritThreshold: binItem.critical,
            changeQty: 0,
            unitWeight: netWeight / binItem.max,
            isSync: false,
          };
        }
      }

      // Update bin
      await this._binMRepository.updateFirst(
        {},
        {
          $set: {
            isLocked: true,
            isCalibrated: true,
            newMax: 0,
            max: (bin.newMax || 0) > 0 ? bin.newMax : bin.max,
          },
        },
        {},
      );

      // Publish MQTT topic
      // mqttClient.publish('bin/close', JSON.stringify({}));
    }

    // Update device
    await this._repository.update(device.id, dataDeviceUpdated);

    return true;
  }
}

type UpdateDeviceRequest = {
  id: number;
  deviceId: number;
  weight: number;
  zeroWeight: number;
  calcWeight: number;
  quantityMinThreshold: number;
  quantityCritThreshold: number;
  deviceDescription: {
    name: string;
    supplierEmail?: string;
    matlGrp?: string;
    criCode?: string;
    jom?: string;
    itemAcct?: string;
    field1?: string;
    // bag1
    expiryBag?: Date;
    quantityBag?: number;
    batchNoBag?: string;
    // bag2
    expiryBag2?: Date;
    quantityBag2?: number;
    batchNoBag2?: string;
    // bag3
    quantityBag3?: number;
    expiryBag3?: Date;
    batchNoBag3?: string;
  };
};
