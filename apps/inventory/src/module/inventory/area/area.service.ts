import { AreaEntity, JobCardEntity } from '@entity';
import { Inject, Injectable } from '@nestjs/common';

import { AREA_REPOSITORY_TOKEN, IAreaRepository } from './repositories';

@Injectable()
export class AreaService {
  constructor(@Inject(AREA_REPOSITORY_TOKEN) private readonly _repository: IAreaRepository) {}

  public async getAreas(): Promise<AreaEntity[]> {
    return this._repository.findAll();
  }

  public async getAreasByIds(ids: string[]): Promise<AreaEntity[]> {
    return this._repository.findByIds(ids);
  }
}
