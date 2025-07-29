import { IPublisher, PublishOptions, Transport } from './publisher.types';

export class MultiTransportPublisher {
  private _publishers: Map<Transport, IPublisher> = new Map();

  public addPublisher(transport: Transport, publisher: IPublisher): void {
    this._publishers.set(transport, publisher);
  }

  public async publish(
    transport: Transport,
    channel: string,
    data: Record<string, any>,
    metadata?: Record<string, any>,
    options?: PublishOptions,
  ): Promise<any> {
    const publisher = this._publishers.get(transport);
    if (!publisher) {
      throw new Error(`Publisher for transport ${transport} not found`);
    }

    return publisher.publish(channel, data, metadata, options);
  }

  public async publishToAll(
    channel: string,
    data: Record<string, any>,
    metadata?: Record<string, any>,
    options?: PublishOptions,
  ): Promise<any> {
    const promises = Array.from(this._publishers.values()).map(async (publisher) => publisher.publish(channel, data, metadata, options));

    return Promise.all(promises);
  }

  public getPublisher(transport: Transport): IPublisher | undefined {
    return this._publishers.get(transport);
  }

  public getAvailableTransports(): Transport[] {
    return Array.from(this._publishers.keys());
  }
}
