import { QueryCondition, QueryOperator } from '@framework/types';
import { Inject, Injectable } from '@nestjs/common';

import { GetUsersDto } from './dtos/request';
import { USER_REPOSITORY_TOKEN, IUserRepository } from './repositories';
import { UserEntity } from '@entity';

@Injectable()
export class UserService {
  constructor(@Inject(USER_REPOSITORY_TOKEN) private readonly _userRepository: IUserRepository) {}

  public async findByLoginId(loginId: string): Promise<UserEntity | null> {
    return this._userRepository.findByLoginId(loginId);
  }

  public async findAll(dto: GetUsersDto) {
    const { limit = 10, page = 1 } = dto;
    const filters: QueryCondition[] = [
      {
        field: 'loginId',
        operator: QueryOperator.NOT_EQUAL,
        value: 'drk_admin',
      },
    ];
    return this._userRepository.findAll(filters, { limit, page });
  }
}
