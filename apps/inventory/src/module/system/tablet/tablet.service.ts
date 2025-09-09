import { TabletEntity } from '@dals/mongo/entities';
import { EntityRepository, ObjectId } from '@mikro-orm/mongodb';
import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable } from '@nestjs/common';

import { RegisterTabletRequest } from './dtos/request';

@Injectable()
export class TabletService {
  constructor(@InjectRepository(TabletEntity) private readonly _tabletRepository: EntityRepository<TabletEntity>) {}
  public async findByClientId(clientId: string): Promise<TabletEntity | null> {
    return this._tabletRepository.findOne({
      clientId,
    });
  }

  public async register(dto: RegisterTabletRequest): Promise<boolean> {
    const tablet = await this._tabletRepository.upsert({
      clientId: dto.clientId,
      site: new ObjectId(dto.siteId),
      cluster: new ObjectId(dto.clusterId),
      accessKey: dto.accessKey,
      isMfaEnabled: dto.isMfaEnabled,
    });

    return true;
  }
}
