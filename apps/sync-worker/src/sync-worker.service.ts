import { SiteEntity, UserEntity } from '@dals/mongo/entities';
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
  ) {}

  public async syncUsers(): Promise<boolean> {
    let nextPage: string | undefined = undefined;

    while (true) {
      try {
        const result = await this._cloudService.getPaginationUsers(nextPage || 'https://e-platform.drk-system.com');

        if (!result || result.list.length === 0) {
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
            updatedAt: user.updatedAt,
            createdAt: user.createdAt,
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
}
