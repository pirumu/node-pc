import { Provider } from '@nestjs/common';

import { CabinetController } from './cabinet.controller';
import { CabinetService } from './cabinet.service';
import { CABINET_REPOSITORY_TOKEN } from './repositories';
import { CabinetImplRepository } from './repositories/impls';

export const CONTROLLERS = [CabinetController];
export const SERVICES_PROVIDERS = [CabinetService];
export const SERVICES_EXPORTS = [CabinetService];

export const REPOSITORY_PROVIDERS: Provider[] = [
  {
    provide: CABINET_REPOSITORY_TOKEN,
    useClass: CabinetImplRepository,
  },
];
