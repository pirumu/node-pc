import { PaginatedResult, PaginationMeta } from '@common/dto';
import { ClusterEntity } from '@dals/mongo/entities';
import { EntityRepository } from '@mikro-orm/mongodb';
import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ClusterService {
  constructor(@InjectRepository(ClusterEntity) private readonly _clusterRepository: EntityRepository<ClusterEntity>) {}

  public async getClusters(page: number, limit: number, enrich?: boolean): Promise<PaginatedResult<ClusterEntity>> {
    const [rows, count] = await Promise.all([
      this._clusterRepository.findAll({
        limit,
        offset: (page - 1) * limit,
        populate: enrich ? ['site'] : [],
      }),
      this._clusterRepository.count(),
    ]);

    return new PaginatedResult<ClusterEntity>(
      rows,
      new PaginationMeta({
        page: page,
        limit: limit,
        total: count,
      }),
    );
  }
}
