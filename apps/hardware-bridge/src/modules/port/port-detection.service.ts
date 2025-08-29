import { EVENT_TYPE } from '@common/constants';
import { PublisherService, Transport } from '@framework/publisher';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectSerialManager, ISerialAdapter } from '@serialport/serial';

@Injectable()
export class PortDetectionService implements OnModuleInit {
  constructor(
    @InjectSerialManager()
    private readonly _serialAdapter: ISerialAdapter,
    private readonly _publisherService: PublisherService,
  ) {}

  public async onModuleInit(): Promise<void> {
    try {
      const availablePorts = await this._serialAdapter.listPorts(true);
      const data = availablePorts.map((port) => ({
        path: port.path,
      }));
      Logger.log('Port found', data, PortDetectionService.name);
      await this._publisherService.publish(Transport.MQTT, EVENT_TYPE.SYSTEM.PORT_DISCOVERING, { ports: data }, {}, { async: true });
    } catch (error) {
      Logger.error(
        'Can not discovery ports',
        {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        PortDetectionService.name,
      );
    }
  }
}
