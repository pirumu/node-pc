import { CONDITION_TYPE } from '@common/constants';
import {
  ClusterEntity,
  SiteEntity,
  UserEntity,
  WorkingOrderEntity,
  CabinetEntity,
  ItemTypeEntity,
  AreaEntity,
  ConditionEntity,
  CabinetType,
  ItemTypeCategoryType,
} from '@dals/mongo/entities';
import { EntityRepository, ObjectId } from '@mikro-orm/mongodb';
import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable, Logger } from '@nestjs/common';
import { CloudService } from '@services/cloud';

@Injectable()
export class SyncWorkerService {
  private readonly _logger = new Logger(SyncWorkerService.name);
  constructor(
    private readonly _cloudService: CloudService,
    @InjectRepository(UserEntity)
    private readonly _userRepository: EntityRepository<UserEntity>,
    @InjectRepository(SiteEntity)
    private readonly _siteRepository: EntityRepository<SiteEntity>,
    @InjectRepository(WorkingOrderEntity)
    private readonly _workingOrderRepository: EntityRepository<WorkingOrderEntity>,
    @InjectRepository(ClusterEntity)
    private readonly _clusterRepository: EntityRepository<ClusterEntity>,
    @InjectRepository(CabinetEntity)
    private readonly _cabinetRepository: EntityRepository<CabinetEntity>,
    @InjectRepository(ItemTypeEntity)
    private readonly _itemTypeRepository: EntityRepository<ItemTypeEntity>,
    @InjectRepository(AreaEntity)
    private readonly _areaRepository: EntityRepository<AreaEntity>,
    @InjectRepository(ConditionEntity)
    private readonly _conditionRepository: EntityRepository<ConditionEntity>,
  ) {}

  public async syncUsers(): Promise<boolean> {
    let nextPage: string | undefined = undefined;

    while (true) {
      try {
        const result = await this._cloudService.getPaginationUsers(nextPage);

        if (!result || result.list?.length === 0) {
          break;
        }

        const siteIds = result.list.map((user) => user.siteIds.map((site) => site.$oid)).flat();
        const uniqueSiteIds = [...new Set(siteIds)];

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

        await this._userRepository.upsertMany(
          result.list.map((user) => ({
            _id: new ObjectId(user.id),
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            phone: user.phone,
            address: user.address,
            avatar: user.avatar,
            email: user.email,
            status: user.status,
            role: user.roleKey,
            sites: (user.siteIds || []).map((site) => new ObjectId(site.$oid)),
            permissions: user.permissions || [],
            updatedAt: new Date(user.updatedAt),
            createdAt: new Date(user.createdAt),
            createdBy: new ObjectId(user.createdBy),
            updatedBy: new ObjectId(user.updatedBy),
          })),
        );

        if (!result.next) {
          break;
        }
        nextPage = result.next;
      } catch (e) {
        this._logger.error(e);
        break;
      }
    }

    return true;
  }

  public async syncWorkingOrders(): Promise<boolean> {
    let nextPage: string | undefined = undefined;

    while (true) {
      try {
        const result = await this._cloudService.getPaginationWorkingOrders(nextPage);

        if (!result || result.list?.length === 0) {
          break;
        }

        await this._workingOrderRepository.upsertMany(
          result.list.map((workingOrder) => ({
            _id: new ObjectId(workingOrder.id),
            code: workingOrder.code,
            description: workingOrder.description,
            site: new ObjectId(workingOrder.siteId),
            createdAt: workingOrder.createdAt,
            updatedAt: workingOrder.updatedAt,
            createdBy: new ObjectId(workingOrder.createdBy),
            updatedBy: new ObjectId(workingOrder.updatedBy),
          })),
        );

        if (!result.next) {
          break;
        }
        nextPage = result.next;
      } catch (e) {
        this._logger.error(e);
        break;
      }
    }

    return true;
  }

  public async syncClusters(): Promise<boolean> {
    let nextPage: string | undefined = undefined;

    while (true) {
      try {
        const result = await this._cloudService.getPaginationClusters(nextPage);

        if (!result || result.list?.length === 0) {
          break;
        }

        await this._clusterRepository.upsertMany(
          result.list.map((cluster) => ({
            _id: new ObjectId(cluster.id),
            site: new ObjectId(cluster.siteId),
            name: cluster.name,
            code: cluster.code,
            isRFID: cluster.isRFID,
            isVirtual: cluster.isVirtual,
            createdAt: new Date(cluster.createdAt),
            updatedAt: new Date(cluster.updatedAt),
            createdBy: new ObjectId(cluster.createdBy),
            updatedBy: new ObjectId(cluster.updatedBy),
          })),
        );

        if (!result.next) {
          break;
        }

        nextPage = result.next;
      } catch (e) {
        this._logger.error(e);
        break;
      }
    }

    return true;
  }

  public async syncCabinets(): Promise<boolean> {
    let nextPage: string | undefined = undefined;

    while (true) {
      try {
        const result = await this._cloudService.getPaginationCabinets(nextPage);

        if (!result || result.list?.length === 0) {
          break;
        }

        await this._cabinetRepository.upsertMany(
          result.list.map((cabinet) => ({
            _id: new ObjectId(cabinet.id),
            site: new ObjectId(cabinet.siteId),
            cluster: new ObjectId(cabinet.clusterId),
            name: cabinet.name,
            rowNumber: cabinet.rowNumber,
            binNumber: cabinet.binNumber,
            type: cabinet.type as CabinetType,
            binType: cabinet.binType,
            loadcellPerBin: cabinet.loadcellPerBin,
            createdAt: new Date(cabinet.createdAt),
            updatedAt: new Date(cabinet.updatedAt),
            createdBy: new ObjectId(cabinet.createdBy),
            updatedBy: new ObjectId(cabinet.updatedBy),
          })),
        );

        if (!result.next) {
          break;
        }

        nextPage = result.next;
      } catch (e) {
        this._logger.error(e);
        break;
      }
    }

    return true;
  }

  public async syncItemTypes(): Promise<boolean> {
    let nextPage: string | undefined = undefined;

    while (true) {
      try {
        const result = await this._cloudService.getPaginationItemTypes(nextPage);

        if (!result || result.list?.length === 0) {
          break;
        }

        await this._itemTypeRepository.upsertMany(
          result.list.map((itemType) => ({
            _id: new ObjectId(itemType.id),
            site: new ObjectId(itemType.siteId),
            name: itemType.name,
            description: itemType.description || '',
            category: itemType.category as ItemTypeCategoryType,
            createdAt: new Date(itemType.createdAt),
            updatedAt: new Date(itemType.updatedAt),
            createdBy: new ObjectId(itemType.createdBy),
            updatedBy: new ObjectId(itemType.updatedBy),
          })),
        );

        if (!result.next) {
          break;
        }

        nextPage = result.next;
      } catch (e) {
        this._logger.error(e);
        break;
      }
    }

    return true;
  }

  public async syncAreas(): Promise<boolean> {
    let nextPage: string | undefined = undefined;

    while (true) {
      try {
        const result = await this._cloudService.getPaginationAreas(nextPage);

        if (!result || result.list?.length === 0) {
          break;
        }

        await this._areaRepository.upsertMany(
          result.list.map((area) => ({
            _id: new ObjectId(area.id),
            site: new ObjectId(area.siteId),
            name: area.name,
            torque: parseFloat(area.torque) || 0,
            createdAt: new Date(area.createdAt),
            updatedAt: new Date(area.updatedAt),
            createdBy: new ObjectId(area.createdBy),
            updatedBy: new ObjectId(area.updatedBy),
          })),
        );

        if (!result.next) {
          break;
        }

        nextPage = result.next;
      } catch (e) {
        this._logger.error(e);
        break;
      }
    }

    return true;
  }

  public async syncConditions(): Promise<boolean> {
    let nextPage: string | undefined = undefined;

    while (true) {
      try {
        const result = await this._cloudService.getPaginationConditions(nextPage);

        if (!result || result.list?.length === 0) {
          break;
        }

        await this._conditionRepository.upsertMany(
          result.list.map((condition) => ({
            _id: new ObjectId(condition.id),
            site: new ObjectId(condition.siteId),
            name: condition.name as CONDITION_TYPE,
            isSystemType: condition.isSystemType,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: new ObjectId(condition.createdBy),
            updatedBy: new ObjectId(condition.updatedBy),
          })),
        );

        if (!result.next) {
          break;
        }

        nextPage = result.next;
      } catch (e) {
        this._logger.error(e);
        break;
      }
    }

    return true;
  }
}
