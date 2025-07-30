import { Properties } from '@framework/types';

import { DeviceEntity } from './device.entity';
import { PortEntity } from './port.entity';

export class DevicePortEntity extends DeviceEntity {
  port?: PortEntity;

  constructor(props: Properties<DevicePortEntity>) {
    const { port, ...p } = props;
    super(p);
    this.port = port;
  }
}
