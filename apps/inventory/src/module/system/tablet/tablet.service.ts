import { TabletEntity, ClusterEntity } from '@dals/mongo/entities';
import { AppHttpException } from '@framework/exception';
import { EntityRepository, ObjectId } from '@mikro-orm/mongodb';
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

    const entity = await this._tabletRepository.upsert({
      clientId: dto.clientId,
      cluster: {
        _id: cluster._id,
      },
      publicKey: dto.publicKey,
      isMfaEnabled: dto.isMfaEnabled,
    });

    return !!entity;
  }
}
