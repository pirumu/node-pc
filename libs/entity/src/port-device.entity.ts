import { PortEntity } from './port.entity';
import { Properties } from '@framework/types';
import { DeviceEntity } from './device.entity';

export class PortDeviceEntity extends PortEntity {
  devices: DeviceEntity[];

  constructor(props: Properties<PortDeviceEntity>) {
    const { devices, ...p } = props;
    super(p);
    this.devices = devices;
  }
}
