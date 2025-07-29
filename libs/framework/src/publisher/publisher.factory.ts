import { HTTPPublisher, HTTPPublishConfigOptions } from './http';
import { MQTTPublisher, MQTTPublishOptions } from './mqtt';
import { IPublisher } from './publisher.types';
import { TCPPublisher, TCPPublishOptions } from './tcp';

export class PublisherFactory {
  public static createMQTTPublisher(options: MQTTPublishOptions): IPublisher {
    return new MQTTPublisher(options);
  }
  public static createTCPPublisher(options: TCPPublishOptions): IPublisher {
    return new TCPPublisher(options);
  }

  public static createHTTPPublisher(options: HTTPPublishConfigOptions): IPublisher {
    return new HTTPPublisher(options);
  }
}
