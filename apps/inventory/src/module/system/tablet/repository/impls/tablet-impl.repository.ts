import { TabletMRepository } from '@dals/mongo/repositories';
import { TabletEntity } from '@entity';
import { TabletMapper } from '@mapper';
import { Injectable } from '@nestjs/common';

import { ITabletRepository } from '../tablet.repository';

@Injectable()
export class TabletImplRepository implements ITabletRepository {
  constructor(private readonly _mrepository: TabletMRepository) {}

  public async exist(deviceKey: string): Promise<boolean> {
    return this._mrepository.exists({ deviceKey });
  }

  public async findOne(): Promise<TabletEntity | null> {
    const model = await this._mrepository.findFirst({}, { lean: true });
    return TabletMapper.toEntity(model);
  }

  public async create(entity: TabletEntity): Promise<TabletEntity> {
    const model = TabletMapper.toModel(entity);
    const result = await this._mrepository.create(model);
    return TabletMapper.toEntity(result) as TabletEntity;
  }

  public async update(id: string, data: Partial<TabletEntity>): Promise<boolean> {
    const result = await this._mrepository.updateFirst(
      {
        _id: id,
      },
      data,
      {
        returnDocument: 'after',
      },
    );

    return result.modifiedCount > 0;
  }

  public async findByDeviceId(deviceId: string): Promise<TabletEntity | null> {
    const model = await this._mrepository.findFirst({ deviceId }, { lean: true });
    return TabletMapper.toEntity(model);
  }
}
