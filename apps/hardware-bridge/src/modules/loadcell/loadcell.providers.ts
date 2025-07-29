import { Provider } from '@nestjs/common';

import { LoadcellBridgeService } from './loadcell-bridge.service';
import { LoadcellHttpController } from './loadcell-http.controller';
import { LoadcellMqttController } from './loadcell-mqtt.controller';
import { LOADCELL_REPOSITORY_TOKEN } from './repositories';
import { LoadcellImplRepository } from './repositories/impls';

export const CONTROLLERS = [LoadcellMqttController, LoadcellHttpController];
export const SERVICES_PROVIDERS = [LoadcellBridgeService];
export const SERVICES_EXPORTS = [];

export const REPOSITORY_PROVIDERS: Provider[] = [
  {
    provide: LOADCELL_REPOSITORY_TOKEN,
    useClass: LoadcellImplRepository,
  },
];
