import { CloudConfig } from '@config/contracts';
import { CONFIG_KEY } from '@config/core';
import { IHttpClient, InjectHttpClient } from '@framework/http-client';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CLOUD_PATHS } from '@services/cloud/cloud.constants';
import {
  PaginationResponse,
  UserDto,
  ClusterDto,
  CabinetDto,
  ItemTypeDto,
  WorkingOrderDto,
  AreaDto,
  ConditionDto,
  BinDto,
  LoadcellDto,
  ItemDto,
} from '@services/dto';

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

  public async getPaginationClusters(nextPage?: string): Promise<PaginationResponse<ClusterDto>> {
    const { host, siteAccessKey } = this._configService.getOrThrow<CloudConfig>(CONFIG_KEY.CLOUD);

    const baseURL = nextPage ?? `${host}${CLOUD_PATHS.GET_LIST_CLUSTER}`;

    const options = {
      baseURL: baseURL,
      headers: { ['access-key']: siteAccessKey },
    };

    try {
      const result = await this._httpClient.get<PaginationResponse<ClusterDto>>('', undefined, options);
      return result.data;
    } catch (error) {
      this._logger.error(`Fail to get clusters`, error);
      throw new InternalServerErrorException(error);
    }
  }

  public async getPaginationCabinets(nextPage?: string): Promise<PaginationResponse<CabinetDto>> {
    const { host, siteAccessKey } = this._configService.getOrThrow<CloudConfig>(CONFIG_KEY.CLOUD);

    const baseURL = nextPage ?? `${host}${CLOUD_PATHS.GET_LIST_CABINET}`;

    const options = {
      baseURL: baseURL,
      headers: { ['access-key']: siteAccessKey },
    };

    try {
      const result = await this._httpClient.get<PaginationResponse<CabinetDto>>('', undefined, options);
      return result.data;
    } catch (error) {
      this._logger.error(`Fail to get cabinets`, error);
      throw new InternalServerErrorException(error);
    }
  }

  public async getPaginationItemTypes(nextPage?: string): Promise<PaginationResponse<ItemTypeDto>> {
    const { host, siteAccessKey } = this._configService.getOrThrow<CloudConfig>(CONFIG_KEY.CLOUD);

    const baseURL = nextPage ?? `${host}${CLOUD_PATHS.GET_LIST_ITEM_TYPE}`;

    const options = {
      baseURL: baseURL,
      headers: { ['access-key']: siteAccessKey },
    };

    try {
      const result = await this._httpClient.get<PaginationResponse<ItemTypeDto>>('', undefined, options);
      return result.data;
    } catch (error) {
      this._logger.error(`Fail to get item types`, error);
      throw new InternalServerErrorException(error);
    }
  }

  public async getPaginationItems(nextPage?: string): Promise<PaginationResponse<ItemDto>> {
    const { host, siteAccessKey } = this._configService.getOrThrow<CloudConfig>(CONFIG_KEY.CLOUD);

    const baseURL = nextPage ?? `${host}${CLOUD_PATHS.GET_LIST_ITEM}`;

    const options = {
      baseURL: baseURL,
      headers: { ['access-key']: siteAccessKey },
    };

    try {
      const result = await this._httpClient.get<PaginationResponse<ItemDto>>('', undefined, options);
      return result.data;
    } catch (error) {
      this._logger.error(`Fail to get items`, error);
      throw new InternalServerErrorException(error);
    }
  }

  public async getPaginationAreas(nextPage?: string): Promise<PaginationResponse<AreaDto>> {
    const { host, siteAccessKey } = this._configService.getOrThrow<CloudConfig>(CONFIG_KEY.CLOUD);

    const baseURL = nextPage ?? `${host}${CLOUD_PATHS.GET_LIST_AREA}`;

    const options = {
      baseURL: baseURL,
      headers: { ['access-key']: siteAccessKey },
    };

    try {
      const result = await this._httpClient.get<PaginationResponse<AreaDto>>('', undefined, options);
      return result.data;
    } catch (error) {
      this._logger.error(`Fail to get areas`, error);
      throw new InternalServerErrorException(error);
    }
  }

  public async getPaginationConditions(nextPage?: string): Promise<PaginationResponse<ConditionDto>> {
    const { host, siteAccessKey } = this._configService.getOrThrow<CloudConfig>(CONFIG_KEY.CLOUD);

    const baseURL = nextPage ?? `${host}${CLOUD_PATHS.GET_LIST_CONDITION}`;

    const options = {
      baseURL: baseURL,
      headers: { ['access-key']: siteAccessKey },
    };

    try {
      const result = await this._httpClient.get<PaginationResponse<ConditionDto>>('', undefined, options);
      return result.data;
    } catch (error) {
      this._logger.error(`Fail to get conditions`, error);
      throw new InternalServerErrorException(error);
    }
  }

  public async getPaginationBins(nextPage?: string): Promise<PaginationResponse<BinDto>> {
    const { host, siteAccessKey } = this._configService.getOrThrow<CloudConfig>(CONFIG_KEY.CLOUD);

    const baseURL = nextPage ?? `${host}${CLOUD_PATHS.GET_LIST_BIN}`;

    const options = {
      baseURL: baseURL,
      headers: { ['access-key']: siteAccessKey },
    };

    try {
      const result = await this._httpClient.get<PaginationResponse<BinDto>>('', undefined, options);
      return result.data;
    } catch (error) {
      this._logger.error(`Fail to get bins`, error);
      throw new InternalServerErrorException(error);
    }
  }

  public async getPaginationLoadcells(nextPage?: string): Promise<PaginationResponse<LoadcellDto>> {
    const { host, siteAccessKey } = this._configService.getOrThrow<CloudConfig>(CONFIG_KEY.CLOUD);

    const baseURL = nextPage ?? `${host}${CLOUD_PATHS.GET_LIST_LOADCELL}`;

    const options = {
      baseURL: baseURL,
      headers: { ['access-key']: siteAccessKey },
    };

    try {
      const result = await this._httpClient.get<PaginationResponse<LoadcellDto>>('', undefined, options);
      return result.data;
    } catch (error) {
      this._logger.error(`Fail to get loadcells`, error);
      throw new InternalServerErrorException(error);
    }
  }

  public async getPaginationWorkingOrders(nextPage?: string): Promise<PaginationResponse<WorkingOrderDto>> {
    const { host, siteAccessKey } = this._configService.getOrThrow<CloudConfig>(CONFIG_KEY.CLOUD);

    const baseURL = nextPage ?? `${host}${CLOUD_PATHS.GET_LIST_WORKING_ORDER}`;

    const options = {
      baseURL: baseURL,
      headers: { ['access-key']: siteAccessKey },
    };

    try {
      const result = await this._httpClient.get<PaginationResponse<WorkingOrderDto>>('', undefined, options);
      return result.data;
    } catch (error) {
      this._logger.error(`Fail to get working orders`, error);
      throw new InternalServerErrorException(error);
    }
  }
}
