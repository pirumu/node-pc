import { DeviceEntity } from './device.entity';
import { PortEntity } from './port.entity';
import { Properties } from '@framework/types';

export class DevicePortEntity extends DeviceEntity {
  port?: PortEntity;

  constructor(props: Properties<DevicePortEntity>) {
    const { port, ...p } = props;
    super(p);
    this.port = port;
  }
}
