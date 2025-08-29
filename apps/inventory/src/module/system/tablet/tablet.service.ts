import { TabletEntity, ClusterEntity } from '@dals/mongo/entities';
import { AppHttpException } from '@framework/exception';
import { EntityRepository, ObjectId, Reference } from '@mikro-orm/mongodb';
import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable } from '@nestjs/common';

import { RegisterTabletRequest } from './dtos/request';

@Injectable()
export class TabletService {
  constructor(
    @InjectRepository(ClusterEntity) private readonly _clusterRepository: EntityRepository<ClusterEntity>,
    @InjectRepository(TabletEntity) private readonly _tabletRepository: EntityRepository<TabletEntity>,
  ) {}

  public async register(dto: RegisterTabletRequest): Promise<boolean> {
    const cluster = await this._clusterRepository.findOne({
      _id: new ObjectId(dto.clusterId),
    });

    if (!cluster) {
      throw AppHttpException.badRequest({
        message: `Unknown cluster: ${dto.clusterId}`,
        data: {
          clusterId: dto.clusterId,
        },
      });
    }

    await this._tabletRepository.upsert({
      clientId: dto.clientId,
      site: cluster.site,
      cluster: Reference.create(cluster),
      publicKey: 'pk',
      isMfaEnabled: dto.isMfaEnabled,
    });

    return true;
  }
}
