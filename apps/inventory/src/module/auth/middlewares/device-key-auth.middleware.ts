import { AppHttpException } from '@framework/exception';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

import { HEADER_KEYS } from '../../../common';
import { TabletAuthService } from '../services';
// tablet key.
@Injectable()
export class DeviceKeyAuthMiddleware implements NestMiddleware {
  constructor(private readonly _tabletAuthService: TabletAuthService) {}
  public async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const deviceKey = req.headers[HEADER_KEYS.DEVICE_KEY] as unknown as string;

    if (!deviceKey) {
      throw AppHttpException.unauthorized();
    }
    try {
      const isValidRequest = await this._tabletAuthService.verify(deviceKey);
      if (isValidRequest) {
        next();
      }
    } catch (error) {
      throw AppHttpException.internalServerError({ message: 'Cannot verify device key', data: { error } });
    }

    throw AppHttpException.unauthorized({ message: 'Invalid device key', data: { deviceKey } });
  }
}
