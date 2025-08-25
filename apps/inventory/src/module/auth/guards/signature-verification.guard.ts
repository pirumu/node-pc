import * as crypto from 'crypto';

import { TabletEntity } from '@dals/mongo/entities/tablet.entity';
import { AppHttpException } from '@framework/exception';
import { EntityRepository } from '@mikro-orm/mongodb';
import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class SignatureGuard implements CanActivate {
  constructor(
    @InjectRepository(TabletEntity)
    private readonly _tabletRepository: EntityRepository<TabletEntity>,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: Request = context.switchToHttp().getRequest();

    const clientId = request.headers['x-client-id'] as string;
    const timestamp = request.headers['x-timestamp'] as string;
    const signatureFromClient = request.headers['x-signature'] as string;

    if (!clientId || !timestamp || !signatureFromClient) {
      throw AppHttpException.unauthorized({ message: 'Missing signature headers' });
    }

    const requestTime = parseInt(timestamp, 10);
    const currentTime = Date.now();
    if (Math.abs(currentTime - requestTime) > 300000) {
      throw AppHttpException.unauthorized({ message: 'Request timestamp is too old' });
    }

    const device = await this._tabletRepository.findOne({ clientId });
    if (!device) {
      throw AppHttpException.unauthorized({ message: 'Invalid client ID' });
    }

    const method = request.method;
    const urlPath = request.path;
    const bodyString = request.body ? JSON.stringify(request.body) : '';
    const stringToSign = `${method.toUpperCase()}${urlPath}${timestamp}${bodyString}`;

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(stringToSign);
    verifier.end();

    const isVerified = verifier.verify(device.publicKey, signatureFromClient, 'base64');

    if (!isVerified) {
      throw AppHttpException.unauthorized({ message: 'Invalid signature' });
    }

    return true;
  }
}
