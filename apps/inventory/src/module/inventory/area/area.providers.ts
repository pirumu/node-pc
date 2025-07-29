import { Provider } from '@nestjs/common';

import { AreaController } from './area.controller';
import { AreaService } from './area.service';
import { AREA_REPOSITORY_TOKEN } from './repositories';
import { AreaImplRepository } from './repositories/impls';

export const CONTROLLERS = [AreaController];
export const SERVICES_PROVIDERS = [AreaService];
export const SERVICES_EXPORTS = [AreaService];

export const REPOSITORY_PROVIDERS: Provider[] = [
  {
    provide: AREA_REPOSITORY_TOKEN,
    useClass: AreaImplRepository,
  },
];
