import { randomBytes } from 'crypto';

import { TabletEntity } from '@entity';
import { Properties } from '@framework/types';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { CloudService } from '@services';

import { RegisterTabletRequestDto } from './dtos/request';
import { ITabletRepository, TABLET_REPOSITORY_TOKEN } from './repository';

@Injectable()
export class TabletService {
  constructor(
    @Inject(TABLET_REPOSITORY_TOKEN) private _repository: ITabletRepository,
    private readonly _cloudService: CloudService,
  ) {}

  public async exist(deviceKey: string): Promise<boolean> {
    return this._repository.exist(deviceKey);
  }

  public async register(dto: RegisterTabletRequestDto, deviceId: string): Promise<string> {
    const isValidCredential = await this._verifyCredentials(dto.username, dto.password, dto.cloudUrl);
    if (!isValidCredential) {
      throw new UnauthorizedException('Invalid cloud credentials');
    }

    const deviceKey = this._generateDeviceKey();

    const tabletData: Properties<TabletEntity> = {
      id: '',
      deviceId,
      deviceKey,
      setting: {
        clusterId: dto.clusterId,
        username: dto.username,
        password: dto.password,
        intervalSyncTime: dto.intervalSyncTime,
        cloudUrl: dto.cloudUrl,
        compensationTime: dto.compensationTime,
        torqueWrenchTypeId: dto.torqueWrenchTypeId,
        is2fa: dto.is2fa,
        accessKey: dto.accessKey,
      },
    };

    const tablet = new TabletEntity(tabletData);

    const existingTablet = await this._repository.findOne();

    if (existingTablet) {
      await this._repository.update(existingTablet.id, tablet);
    } else {
      await this._repository.create(tablet);
    }
    return deviceKey;
  }

  private async _verifyCredentials(host: string, username: string, password: string): Promise<boolean> {
    return this._cloudService.verifyCloudCredentials(host, {
      username,
      password,
    });
  }

  private _generateDeviceKey(): string {
    return randomBytes(40).toString('hex');
  }
}
