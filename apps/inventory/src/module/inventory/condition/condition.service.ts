import { CONDITION_TYPE } from '@common/constants';
import { ConditionEntity } from '@dals/mongo/entities';
import { EntityRepository, ObjectId } from '@mikro-orm/mongodb';
import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ConditionService {
  constructor(@InjectRepository(ConditionEntity) private readonly _conditionRepository: EntityRepository<ConditionEntity>) {}

  public async getConditions(siteId: string, excludeName: CONDITION_TYPE[]): Promise<ConditionEntity[]> {
    const conditions =
      excludeName.length > 0
        ? {
            where: {
              site: {
                _id: new ObjectId(siteId),
              },
              name: { $nin: excludeName },
            },
          }
        : {
            where: {
              site: {
                _id: new ObjectId(siteId),
              },
            },
          };
    return this._conditionRepository.findAll(conditions);
  }
}
