import { AreaMRepository } from '@dals/mongo/repositories';
import { AreaEntity } from '@entity';
import { AreaMapper } from '@mapper';
import { Injectable } from '@nestjs/common';

import { IAreaRepository } from '../area.repository';

@Injectable()
export class AreaImplRepository implements IAreaRepository {
  constructor(private readonly _repository: AreaMRepository) {
    this._repository.findMany({}).then((results) => {
      console.log('result', AreaMapper.toEntities(results));
    });
  }

  public async findAll(): Promise<AreaEntity[]> {
    const results = await this._repository.findMany({});
    return AreaMapper.toEntities(results);
  }

  public async findByIds(ids: string[]): Promise<AreaEntity[]> {
    const results = await this._repository.findMany({ _id: { $in: ids } });
    return AreaMapper.toEntities(results);
  }
}
