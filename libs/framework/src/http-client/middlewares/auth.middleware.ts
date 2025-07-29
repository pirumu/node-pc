import { IHttpMiddleware, IHttpServiceRequestOptions } from '../http-client.interfaces';

export class AuthMiddleware implements IHttpMiddleware {
  constructor(private getToken: () => string | Promise<string>) {}

  async onRequest(config: IHttpServiceRequestOptions): Promise<IHttpServiceRequestOptions> {
    const token = await this.getToken();
    if (token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      };
    }
    return config;
  }
}
