import { Provider } from '@nestjs/common';

import { PortController } from './port.controller';
import { PortService } from './port.service';
import { PORT_REPOSITORY_TOKEN } from './repositories';
import { PortImplRepository } from './repositories/impls';

export const CONTROLLERS = [PortController];
export const SERVICES_PROVIDERS = [PortService];
export const SERVICES_EXPORTS = [PortService];

export const REPOSITORY_PROVIDERS: Provider[] = [
  {
    provide: PORT_REPOSITORY_TOKEN,
    useClass: PortImplRepository,
  },
];
