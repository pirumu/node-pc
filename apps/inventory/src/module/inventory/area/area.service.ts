import { PaginatedResult, PaginationMeta } from '@common/dto';
import { AreaEntity } from '@dals/mongo/entities';
import { EntityRepository } from '@mikro-orm/mongodb';
import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AreaService {
  constructor(@InjectRepository(AreaEntity) private readonly _areaRepository: EntityRepository<AreaEntity>) {}

  public async getAreas(page: number, limit: number): Promise<PaginatedResult<AreaEntity>> {
    const [rows, count] = await Promise.all([
      this._areaRepository.findAll({
        limit,
        offset: (page - 1) * limit,
      }),
      this._areaRepository.count(),
    ]);

    return new PaginatedResult<AreaEntity>(
      rows,
      new PaginationMeta({
        page: page,
        limit: limit,
        total: count,
      }),
    );
  }
}
