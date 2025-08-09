import { Injectable, Inject, Logger } from '@nestjs/common';

import { MultiTransportPublisher } from './multi-transport.publisher';
import { MULTI_PUBLISHER } from './publisher.constants';
import { IPublisher, Transport, Priority, PublishOptions } from './publisher.types';

@Injectable()
export class PublisherService {
  private readonly _logger = new Logger(PublisherService.name);

  constructor(
    @Inject(MULTI_PUBLISHER)
    private readonly _multiPublisher: MultiTransportPublisher,
  ) {}

  public async publish<T = any>(
    transport: Transport,
    channel: string,
    data: Record<string, any>,
    metadata?: Record<string, any>,
    options?: PublishOptions,
  ): Promise<T> {
    try {
      this._logger.debug(`Publishing to ${transport}:${channel}`, {
        data,
        options,
      });
      const response = await this._multiPublisher.publish(transport, channel, data, metadata, options);
      this._logger.log(`Successfully published to ${transport}:${channel}`);
      return response as unknown as T;
    } catch (error) {
      this._logger.error(`Failed to publish to ${transport}:${channel}`, {
        name: error.name,
        message: error.message,
        stack: error.stack,
        cause: error.cause,
        code: error.code,
      });
      throw error;
    }
  }

  public async publishToAll(channel: string, data: Record<string, unknown>, options?: PublishOptions): Promise<void> {
    try {
      this._logger.debug(`Broadcasting to all transports:${channel}`, {
        data,
        options,
      });
      await this._multiPublisher.publishToAll(channel, data, options);
      this._logger.log(`Successfully broadcast to all transports:${channel}`);
    } catch (error) {
      this._logger.error(`Failed to broadcast to all transports:${channel}`, { error: error.message });
    }
  }

  public async publishWithPriority(
    transport: Transport,
    channel: string,
    data: Record<string, any>,
    metadata?: Record<string, any>,
    priority?: Priority,
  ): Promise<void> {
    return this.publish(transport, channel, data, metadata, { priority });
  }

  public getPublisher(transport: Transport): IPublisher | undefined {
    return this._multiPublisher.getPublisher(transport);
  }

  public getAvailableTransports(): Transport[] {
    return this._multiPublisher.getAvailableTransports();
  }

  public isTransportAvailable(transport: Transport): boolean {
    return this._multiPublisher.getPublisher(transport) !== undefined;
  }
}
