import { Area, AreaModel } from '@dals/mongo/schema/area.schema';
import { BinItem, BinItemModel } from '@dals/mongo/schema/bin-item.schema';
import { Bin, BinModel } from '@dals/mongo/schema/bin.schema';
import { Cabinet, CabinetModel } from '@dals/mongo/schema/cabinet.schema';
import { Device, DeviceModel } from '@dals/mongo/schema/device.schema';
import { ItemType, ItemTypeModel } from '@dals/mongo/schema/item-type.schema';
import { Item, ItemModel } from '@dals/mongo/schema/item.schema';
import { JobCard, JobCardModel } from '@dals/mongo/schema/job-card.schema';
import { Port, PortModel } from '@dals/mongo/schema/port.schema';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class Migrate implements OnModuleInit {
  constructor(
    @InjectModel(ItemModel.name) private readonly _item: Model<Item>,
    @InjectModel(ItemTypeModel.name) private readonly _itemType: Model<ItemType>,
    @InjectModel(CabinetModel.name) private readonly _cabinet: Model<Cabinet>,
    @InjectModel(BinModel.name) private readonly _bin: Model<Bin>,
    @InjectModel(BinItemModel.name) private readonly _binItem: Model<BinItem>,
    @InjectModel(PortModel.name) private readonly _port: Model<Port>,
    @InjectModel(DeviceModel.name) private readonly _device: Model<Device>,
    @InjectModel(AreaModel.name) private readonly _area: Model<Area>,
    @InjectModel(JobCardModel.name) private readonly _jobCard: Model<JobCard>,
  ) {}

  public async onModuleInit(): Promise<void> {
    const data = [
      {
        wo: '654321',
        platform: 'MBC',
        vehicleId: 1,
        status: 1,
        cardNumber: '123456',
        vehicleNum: '0001',
        vehicleType: 'Honda Civic',
        isSync: true,
        retryCount: 0,
      },
      {
        wo: '23456',
        platform: 'MBC',
        vehicleId: 2,
        status: 1,
        cardNumber: '11850528',
        vehicleNum: '1234',
        vehicleType: 'Honda Civic',
        isSync: true,
        retryCount: 0,
      },
      {
        wo: '123',
        platform: 'MBC',
        vehicleId: 2,
        status: 1,
        cardNumber: '401456675',
        vehicleNum: '1234',
        vehicleType: 'Honda Civic',
        isSync: true,
        retryCount: 0,
      },
      {
        wo: '386338266',
        platform: 'MBC',
        vehicleId: 1,
        status: 1,
        cardNumber: '386338266',
        vehicleNum: '0001',
        vehicleType: 'Honda Civic',
        isSync: true,
        retryCount: 0,
      },
    ];

    await this._jobCard.insertMany(data);
  }
}
