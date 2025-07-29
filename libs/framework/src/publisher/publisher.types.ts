export enum Priority {
  low = 0,
  normal = 1,
  high = 2,
}

export enum Transport {
  MQTT = 'mqtt',
  TCP = 'tcp',
  HTTP = 'http',
}

// Base publish options
export type BasePublishOptions = {
  priority?: Priority;
  timeout?: number;
  retries?: number;
};

export type PublishOptions = Record<string, unknown> & BasePublishOptions;

export interface IPublisher {
  publish<O extends PublishOptions = PublishOptions, R = any>(
    channel: string,
    data: Record<string, any>,
    metadata?: Record<string, any>,
    options?: O,
  ): Promise<R>;
  connect?(): Promise<void>;
  disconnect?(): Promise<void>;
  isConnected?(): boolean;
}
