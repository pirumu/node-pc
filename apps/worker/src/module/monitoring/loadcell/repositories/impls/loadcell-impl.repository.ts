import { DeviceMRepository } from '@dals/mongo/repositories';
import { DeviceEntity } from '@entity';
import { DeviceMapper } from '@mapper';
import { Injectable } from '@nestjs/common';

import { ILoadcellRepository } from '../loadcell.repository';

@Injectable()
export class LoadcellImplRepository implements ILoadcellRepository {
  constructor(private readonly _repository: DeviceMRepository) {}

  public async findAll(): Promise<DeviceEntity[]> {
    const docs = await this._repository.findMany({});
    return DeviceMapper.toEntities(docs);
  }
}
