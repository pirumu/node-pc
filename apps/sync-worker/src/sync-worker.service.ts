import {
  ClusterEntity,
  SiteEntity,
  UserEntity,
  WorkingOrderEntity,
  CabinetEntity,
  ItemTypeEntity,
  AreaEntity,
  ConditionEntity,
  BinEntity,
  LoadcellEntity,
  ItemEntity,
} from '@dals/mongo/entities';
import { EntityRepository, ObjectId } from '@mikro-orm/mongodb';
import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable, Logger } from '@nestjs/common';
import { CloudService } from '@services/cloud';

import {
  AreaMapper,
  BinMapper,
  CabinetMapper,
  ClusterMapper,
  ConditionMapper,
  ItemMapper,
  ItemTypeMapper,
  LoadcellMapper,
  UserMapper,
  WorkingOrderMapper,
} from './mapper';

@Injectable()
export class SyncWorkerService {
  private readonly _logger = new Logger(SyncWorkerService.name);
  constructor(
    private readonly _cloudService: CloudService,
    @InjectRepository(SiteEntity)
    private readonly _siteRepository: EntityRepository<SiteEntity>,
    @InjectRepository(UserEntity)
    private readonly _userRepository: EntityRepository<UserEntity>,
    @InjectRepository(ClusterEntity)
    private readonly _clusterRepository: EntityRepository<ClusterEntity>,
    @InjectRepository(CabinetEntity)
    private readonly _cabinetRepository: EntityRepository<CabinetEntity>,
    @InjectRepository(ItemTypeEntity)
    private readonly _itemTypeRepository: EntityRepository<ItemTypeEntity>,
    @InjectRepository(ItemEntity)
    private readonly _itemRepository: EntityRepository<ItemEntity>,
    @InjectRepository(AreaEntity)
    private readonly _areaRepository: EntityRepository<AreaEntity>,
    @InjectRepository(ConditionEntity)
    private readonly _conditionRepository: EntityRepository<ConditionEntity>,
    @InjectRepository(LoadcellEntity)
    private readonly _loadcellRepository: EntityRepository<LoadcellEntity>,
    @InjectRepository(BinEntity)
    private readonly _binRepository: EntityRepository<BinEntity>,
    @InjectRepository(WorkingOrderEntity)
    private readonly _workingOrderRepository: EntityRepository<WorkingOrderEntity>,
  ) {}

  public async syncUsers(): Promise<boolean> {
    let isSuccess = true;
    let nextPage: string | undefined = undefined;

    while (true) {
      try {
        const result = await this._cloudService.getPaginationUsers(nextPage);

        if (!result || result.list?.length === 0) {
          break;
        }

        const siteIds = result.list.map((user) => user.siteIds.map((site) => site)).flat();
        const siteStrIds = siteIds.map((siteId) => {
          if (typeof siteId === 'string') {
            return siteId;
          }
          return siteId.$oid;
        });
        const uniqueSiteIds = [...new Set(siteStrIds)];

        if (uniqueSiteIds.length > 0) {
          await this._siteRepository.upsertMany(
            uniqueSiteIds.map((id) => ({
              _id: new ObjectId(id),
            })),
            {
              onConflictFields: ['_id'],
              onConflictAction: 'ignore',
            },
          );
        }
        const { list, next } = result;

        await this._userRepository.upsertMany(
          list.map((user) => UserMapper.fromDto(user)),
          {
            onConflictFields: ['_id'],
            onConflictAction: 'merge',
          },
        );

        if (!next) {
          break;
        }
        nextPage = result.next;
      } catch (e) {
        this._logger.error(e);
        isSuccess = false;
        break;
      }
    }

    return isSuccess;
  }

  public async syncClusters(): Promise<boolean> {
    let isSuccess = true;
    let nextPage: string | undefined = undefined;

    while (true) {
      try {
        const result = await this._cloudService.getPaginationClusters(nextPage);

        if (!result || result.list?.length === 0) {
          break;
        }

        const { list, next } = result;

        await this._clusterRepository.upsertMany(
          list.map((cluster) => ClusterMapper.fromDto(cluster)),
          {
            onConflictFields: ['_id'],
            onConflictAction: 'merge',
          },
        );

        if (!next) {
          break;
        }

        nextPage = next;
      } catch (e) {
        this._logger.error(e);
        isSuccess = false;
        break;
      }
    }

    return isSuccess;
  }

  public async syncCabinets(): Promise<boolean> {
    let isSuccess = true;
    let nextPage: string | undefined = undefined;

    while (true) {
      try {
        const result = await this._cloudService.getPaginationCabinets(nextPage);

        if (!result || result.list?.length === 0) {
          break;
        }

        const { list, next } = result;

        await this._cabinetRepository.upsertMany(
          list.map((cabinet) => CabinetMapper.fromDto(cabinet)),
          {
            onConflictFields: ['_id'],
            onConflictAction: 'merge',
          },
        );

        if (!next) {
          break;
        }

        nextPage = next;
      } catch (e) {
        this._logger.error(e);
        isSuccess = false;
        break;
      }
    }

    return isSuccess;
  }

  public async syncItemTypes(): Promise<boolean> {
    let isSuccess = true;
    let nextPage: string | undefined = undefined;

    while (true) {
      try {
        const result = await this._cloudService.getPaginationItemTypes(nextPage);

        if (!result || result.list?.length === 0) {
          break;
        }

        const { list, next } = result;

        await this._itemTypeRepository.upsertMany(
          list.map((itemType) => ItemTypeMapper.fromDto(itemType)),
          {
            onConflictFields: ['_id'],
            onConflictAction: 'merge',
          },
        );

        if (!next) {
          break;
        }

        nextPage = next;
      } catch (e) {
        this._logger.error(e);
        isSuccess = false;
        break;
      }
    }

    return isSuccess;
  }

  public async syncItems(): Promise<boolean> {
    let isSuccess = true;
    let nextPage: string | undefined = undefined;

    while (true) {
      try {
        const result = await this._cloudService.getPaginationItems(nextPage);

        if (!result || result.list?.length === 0) {
          break;
        }

        const { list, next } = result;

        await this._itemRepository.upsertMany(
          list.map((item) => ItemMapper.fromDto(item)),
          {
            onConflictFields: ['_id'],
            onConflictAction: 'merge',
          },
        );

        if (!next) {
          break;
        }

        nextPage = next;
      } catch (e) {
        this._logger.error(e);
        isSuccess = false;
        break;
      }
    }

    return isSuccess;
  }

  public async syncAreas(): Promise<boolean> {
    let isSuccess = true;
    let nextPage: string | undefined = undefined;

    while (true) {
      try {
        const result = await this._cloudService.getPaginationAreas(nextPage);

        if (!result || result.list?.length === 0) {
          break;
        }

        const { list, next } = result;

        await this._areaRepository.upsertMany(
          list.map((area) => AreaMapper.fromDto(area)),
          {
            onConflictFields: ['_id'],
            onConflictAction: 'merge',
          },
        );

        if (!next) {
          break;
        }

        nextPage = next;
      } catch (e) {
        this._logger.error(e);
        isSuccess = false;
        break;
      }
    }

    return isSuccess;
  }

  public async syncConditions(): Promise<boolean> {
    let isSuccess = true;
    let nextPage: string | undefined = undefined;

    while (true) {
      try {
        const result = await this._cloudService.getPaginationConditions(nextPage);

        if (!result || result.list?.length === 0) {
          break;
        }

        const { list, next } = result;

        await this._conditionRepository.upsertMany(
          list.map((condition) => ConditionMapper.fromDto(condition)),
          {
            onConflictFields: ['_id'],
            onConflictAction: 'merge',
          },
        );

        if (!next) {
          break;
        }

        nextPage = next;
      } catch (e) {
        this._logger.error(e);
        isSuccess = false;
        break;
      }
    }

    return isSuccess;
  }

  public async syncBins(): Promise<boolean> {
    let isSuccess = true;
    let nextPage: string | undefined = undefined;

    while (true) {
      try {
        const result = await this._cloudService.getPaginationBins(nextPage);

        if (!result || result.list?.length === 0) {
          break;
        }

        const { list, next } = result;

        await this._binRepository.upsertMany(
          list.map((bin) => BinMapper.fromDto(bin)),
          {
            onConflictFields: ['_id'],
            onConflictAction: 'merge',
          },
        );

        if (!next) {
          break;
        }

        nextPage = next;
      } catch (e) {
        this._logger.error(e);
        isSuccess = false;
        break;
      }
    }

    return isSuccess;
  }

  public async syncLoadcells(): Promise<boolean> {
    let isSuccess = true;
    let nextPage: string | undefined = undefined;

    while (true) {
      try {
        const result = await this._cloudService.getPaginationLoadcells(nextPage);

        if (!result || result.list?.length === 0) {
          break;
        }

        const { list, next } = result;

        await this._loadcellRepository.upsertMany(
          list.map((loadcell) => LoadcellMapper.fromDto(loadcell)),
          {
            onConflictFields: ['_id'],
            onConflictAction: 'merge',
          },
        );

        if (!next) {
          break;
        }

        nextPage = next;
      } catch (e) {
        this._logger.error(e);
        isSuccess = false;
        break;
      }
    }

    return isSuccess;
  }

  public async syncWorkingOrders(): Promise<boolean> {
    let isSuccess = true;
    let nextPage: string | undefined = undefined;

    while (true) {
      try {
        const result = await this._cloudService.getPaginationWorkingOrders(nextPage);

        if (!result || result.list?.length === 0) {
          break;
        }
        const { list, next } = result;

        await this._workingOrderRepository.upsertMany(
          list.map((workingOrder) => WorkingOrderMapper.fromDto(workingOrder)),
          {
            onConflictFields: ['_id'],
            onConflictAction: 'merge',
          },
        );

        if (!next) {
          break;
        }
        nextPage = next;
      } catch (e) {
        this._logger.error(e);
        isSuccess = false;
        break;
      }
    }

    return isSuccess;
  }
}
