import { Injectable } from '@nestjs/common';

import { GetCabinetsRequest } from './dtos/request';
import { EntityManager, ObjectId } from '@mikro-orm/mongodb';
import { CabinetEntity } from '@dals/mongo/entities';

@Injectable()
export class CabinetService {
  constructor(private readonly _em: EntityManager) {}

  public async getCabinets(query: GetCabinetsRequest): Promise<CabinetEntity[]> {
    return this._em.find(
      CabinetEntity,
      {},
      {
        limit: query.limit || 100,
        offset: ((query.page || 1) - 1) * (query.limit || 100),
      },
    );
  }

  public async getCabinetById(id: string): Promise<CabinetEntity> {
    return this._em.findOneOrFail(CabinetEntity, new ObjectId(id));
  }
}
