import { Provider } from '@nestjs/common';

import { DevicePublisherService } from './device-publisher.service';
import { DeviceController } from './device.controller';
import { DeviceService } from './device.service';
import { DEVICE_REPOSITORY_TOKEN } from './repositories';
import { DeviceImplRepository } from './repositories/impls';

export const CONTROLLERS = [DeviceController];
export const SERVICES_PROVIDERS = [DeviceService, DevicePublisherService];
export const SERVICES_EXPORTS = [DeviceService];

export const REPOSITORY_PROVIDERS: Provider[] = [
  {
    provide: DEVICE_REPOSITORY_TOKEN,
    useClass: DeviceImplRepository,
  },
];
