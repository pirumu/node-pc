import { PaginationMeta } from '@common/dto';
import { UserEntity } from '@dals/mongo/entities';
import { EntityRepository } from '@mikro-orm/mongodb';
import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable } from '@nestjs/common';

@Injectable()
export class UserService {
  constructor(@InjectRepository(UserEntity) private readonly _userRepository: EntityRepository<UserEntity>) {}

  public async findAll(
    page: number,
    limit: number,
  ): Promise<{
    rows: UserEntity[];
    meta: PaginationMeta;
  }> {
    const [rows, count] = await Promise.all([
      this._userRepository.findAll({
        limit,
        offset: (page - 1) * limit,
      }),
      this._userRepository.count(),
    ]);

    return {
      rows,
      meta: new PaginationMeta({
        limit,
        page,
        total: count,
      }),
    };
  }
}
