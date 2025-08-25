import { TRACING_ID } from '@framework/constants';
import { AppHttpException, isNetworkError } from '@framework/exception';
import { Injectable, Logger } from '@nestjs/common';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import { ClsServiceManager } from 'nestjs-cls';
import { delay, lastValueFrom, of, timeout } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';

import { IPublisher, PublishOptions } from '../publisher.types';

import { TCPPublishOptions } from './tcp.types';
import { SnowflakeId } from '@framework/snowflake';

@Injectable()
export class TCPPublisher implements IPublisher {
  private readonly _logger = new Logger(TCPPublisher.name);
  private _client: ClientProxy;
  constructor(options: TCPPublishOptions = {}) {
    this._client = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: options,
    });
  }

  public async publish(
    channel: string,
    data: Record<string, unknown>,
    metadata?: { [TRACING_ID]: string },
    options?: PublishOptions,
  ): Promise<any> {
    try {
      const requestId = ClsServiceManager.getClsService().getId();
      const requestInfo = { [TRACING_ID]: requestId || new SnowflakeId().id(), ...metadata };
      return await lastValueFrom(
        this._client.send(channel, { ...data, metadata: requestInfo }).pipe(
          timeout(options?.timeout ?? 10000),
          retry({
            count: options?.retries || 5,
            delay: (error, retryCount) => {
              this._logger.warn(`Retry attempt ${retryCount} for pattern: ${channel}`);
              return of(error).pipe(delay(1000 * retryCount));
            },
          }),
          catchError((error) => {
            this._logger.error(`Microservice call failed for pattern: ${channel}`, JSON.parse(JSON.stringify(error)));
            if (isNetworkError(error)) {
              throw AppHttpException.internalServerError({
                message: `Microservice call failed for pattern: ${channel}`,
                data: { ...JSON.parse(JSON.stringify(error)), tracingId: requestInfo[TRACING_ID] },
              });
            }
            throw AppHttpException.internalServerError({
              message: `Microservice call failed for pattern: ${channel}`,
              data: {
                name: (error as Error).name,
                message: (error as Error).message,
              },
            });
          }),
        ),
      );
    } catch (error) {
      throw error;
    }
  }
}
