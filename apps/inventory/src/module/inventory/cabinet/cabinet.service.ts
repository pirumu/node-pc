import { CabinetEntity } from '@entity';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';

import { CABINET_REPOSITORY_TOKEN, ICabinetRepository } from './repositories';

@Injectable()
export class CabinetService {
  constructor(@Inject(CABINET_REPOSITORY_TOKEN) private readonly _repository: ICabinetRepository) {}

  public async getCabinets(): Promise<CabinetEntity[]> {
    return this._repository.findAll();
  }

  public async getCabinetById(id: string): Promise<CabinetEntity> {
    const cabinet = await this._repository.findComplexById(id);
    if (!cabinet) {
      throw new BadRequestException(`Cabin with id ${id} not found`);
    }
    return cabinet;
  }
}
