import { IHttpClient, InjectHttpClient } from '@framework/http-client';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { CLOUD_PATHS } from '@services/cloud/cloud.constants';

@Injectable()
export class CloudService {
  private readonly _logger = new Logger(CloudService.name);

  constructor(@InjectHttpClient() private readonly _httpClient: IHttpClient) {}

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
}
