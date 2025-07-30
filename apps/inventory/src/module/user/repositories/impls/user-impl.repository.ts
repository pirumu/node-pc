import { MongoQueryBuilder } from '@dals/mongo';
import { UserMRepository } from '@dals/mongo/repositories';
import { UserEntity } from '@entity';
import { QueryCondition } from '@framework/types';
import { UserMapper } from '@mapper';
import { Injectable } from '@nestjs/common';

import { IUserRepository } from '../user.repository';

@Injectable()
export class UserImplRepository implements IUserRepository {
  constructor(private readonly _repository: UserMRepository) {}

  public async findByLoginId(loginId: string): Promise<UserEntity | null> {
    const model = await this._repository.findFirst({ loginId }, { lean: true });
    return UserMapper.toEntity(model);
  }

  public async findById(userId: string): Promise<UserEntity | null> {
    const model = await this._repository.findById(userId);
    return UserMapper.toEntity(model);
  }

  public async createMany(userEntities: UserEntity[]): Promise<boolean> {
    throw new Error('Method not implemented.');
  }

  public async findAll(
    filters: QueryCondition[],
    pagination: { page: number; limit: number },
  ): Promise<{ total: number; entities: UserEntity[] }> {
    const conditions = MongoQueryBuilder.build(filters);

    const result = await this._repository.paginate(conditions, {
      limit: pagination.limit,
      page: pagination.page,
      lean: true,
      select: ['_id', 'loginId', 'role', 'cardNumber', 'employeeId', 'createdAt', 'updatedAt'],
    });

    const entities = UserMapper.toEntities(result.docs);
    return { total: result.totalDocs, entities };
  }
}
