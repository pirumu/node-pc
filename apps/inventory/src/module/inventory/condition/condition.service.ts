import { CONDITION_TYPE } from '@common/constants';
import { ConditionEntity } from '@dals/mongo/entities';
import { EntityRepository } from '@mikro-orm/mongodb';
import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ConditionService {
  constructor(@InjectRepository(ConditionEntity) private readonly _conditionRepository: EntityRepository<ConditionEntity>) {}

  public async getConditions(excludeName: CONDITION_TYPE[]): Promise<ConditionEntity[]> {
    const conditions = excludeName.length > 0 ? { where: { name: { $nin: excludeName } } } : {};
    return this._conditionRepository.findAll(conditions);
  }
}
