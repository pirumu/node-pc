import { ConditionEntity } from '@entity/condition.entity';

export const CONDITION_REPOSITORY_TOKEN = Symbol('IConditionRepository');

export interface IConditionRepository {
  findAll(conditionWorkingId: string): Promise<ConditionEntity[]>;
}
