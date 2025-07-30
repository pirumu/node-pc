import { Properties } from '@framework/types';

import { DeviceEntity } from './device.entity';
import { PortEntity } from './port.entity';

export class PortDeviceEntity extends PortEntity {
  devices: DeviceEntity[];

  constructor(props: Properties<PortDeviceEntity>) {
    const { devices, ...p } = props;
    super(p);
    this.devices = devices;
  }
}
