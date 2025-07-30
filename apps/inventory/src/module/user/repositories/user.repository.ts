import { UserEntity } from '@entity';
import { QueryCondition } from '@framework/types';

export interface IUserRepository {
  findById(userId: string): Promise<UserEntity | null>;
  findByLoginId(loginId: string): Promise<UserEntity | null>;
  findAll(filters: QueryCondition[], pagination: { page: number; limit: number }): Promise<{ total: number; entities: UserEntity[] }>;
  createMany(userEntities: UserEntity[]): Promise<boolean>;
}

export const USER_REPOSITORY_TOKEN = Symbol('IUserRepository');
