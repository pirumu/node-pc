import { MongoQueryBuilder } from '@dals/mongo';
import { ConditionMRepository } from '@dals/mongo/repositories';
import { ConditionEntity } from '@entity/condition.entity';
import { QueryOperator } from '@framework/types';
import { ConditionMapper } from '@mapper';

import { IConditionRepository } from '../condition.repository';

export class ConditionImplRepository implements IConditionRepository {
  constructor(private readonly _repository: ConditionMRepository) {}

  public async findAll(conditionWorkingId: string): Promise<ConditionEntity[]> {
    const filters = MongoQueryBuilder.build({
      field: '_id',
      operator: QueryOperator.NOT_EQUAL,
      value: conditionWorkingId,
    });
    const results = await this._repository.findMany(filters);
    return ConditionMapper.toEntities(results);
  }
}
