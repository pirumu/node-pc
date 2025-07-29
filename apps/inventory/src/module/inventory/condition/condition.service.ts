import { ConditionEntity } from '@entity';
import { Inject, Injectable } from '@nestjs/common';

import { CONDITION_REPOSITORY_TOKEN, IConditionRepository } from './repositories';

@Injectable()
export class ConditionService {
  constructor(@Inject(CONDITION_REPOSITORY_TOKEN) private readonly _repository: IConditionRepository) {}

  public async getConditions(conditionId: string): Promise<ConditionEntity[]> {
    return this._repository.findAll(conditionId);
  }
}
