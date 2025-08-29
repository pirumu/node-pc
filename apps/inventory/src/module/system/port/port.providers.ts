import { Provider } from '@nestjs/common';

import { PortEventController } from './port-event.controller';
import { PortEventService } from './port-event.service';
import { PortController } from './port.controller';
import { PortService } from './port.service';

export const CONTROLLERS = [PortController, PortEventController];
export const SERVICES_PROVIDERS = [PortService, PortEventService];
export const SERVICES_EXPORTS = [PortService];

export const REPOSITORY_PROVIDERS: Provider[] = [];
