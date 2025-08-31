import { AppConfig, CloudConfig } from '@config/contracts';
import { CONFIG_KEY } from '@config/core';
import { IHttpClient, InjectHttpClient } from '@framework/http-client';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CLOUD_PATHS } from '@services/cloud/cloud.constants';
import { PaginationResponse, UserDto } from '@services/dto';

@Injectable()
export class CloudService {
  private readonly _logger = new Logger(CloudService.name);

  constructor(
    private readonly _configService: ConfigService,
    @InjectHttpClient() private readonly _httpClient: IHttpClient,
  ) {}

  public async verifyCloudCredentials(host: string, credentials: { username: string; password: string }): Promise<boolean> {
    try {
      const options = {
        headers: {
          ['cache-control']: 'no-cache',
          ['Content-Type']: 'application/x-www-form-urlencoded',
        },
      };

      const body = new URLSearchParams();
      body.append('username', credentials.username);
      body.append('password', credentials.password);

      const result = await this._httpClient.post<{ access_token?: string }>(`${host}${CLOUD_PATHS.LOGIN}`, body.toString(), options);
      return !!result.data?.access_token;
    } catch (err) {
      this._logger.error(`Fail to verify cloud credentials`, err);
      throw new InternalServerErrorException(err);
    }
  }

  public async getPaginationUsers(nextPage?: string): Promise<PaginationResponse<UserDto>> {
    const { host, siteAccessKey } = this._configService.getOrThrow<CloudConfig>(CONFIG_KEY.CLOUD);

    const baseURL = nextPage ?? `${host}${CLOUD_PATHS.GET_LIST_USER}`;

    const options = {
      baseURL: baseURL,
      headers: { ['access-key']: siteAccessKey },
    };

    try {
      const result = await this._httpClient.get<PaginationResponse<UserDto>>('', undefined, options);
      return result.data;
    } catch (error) {
      this._logger.error(`Fail to get users`, error);
      throw new InternalServerErrorException(error);
    }
  }
}
