import { AppHttpException } from '@framework/exception';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { TokenExpiredError } from '@nestjs/jwt';
import { NextFunction, Request, Response } from 'express';

import { getBearToken } from '../auth.helper';
import { JwtAuthService } from '../services';

@Injectable()
export class JwtAuthMiddleware implements NestMiddleware {
  constructor(private readonly _authService: JwtAuthService) {}
  public async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const jwt = getBearToken(req.headers.authorization);

    if (!jwt) {
      throw AppHttpException.unauthorized();
    }

    try {
      req.user = await this._authService.verify(jwt);
      return next();
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        throw AppHttpException.unauthorized();
      }
      throw AppHttpException.internalServerError({ message: 'Cannot verify JWT auth token', data: { error } });
    }
  }
}
