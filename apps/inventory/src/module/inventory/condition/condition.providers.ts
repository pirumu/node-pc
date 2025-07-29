import { Provider } from '@nestjs/common';

import { ConditionController } from './condition.controller';
import { ConditionService } from './condition.service';
import { CONDITION_REPOSITORY_TOKEN } from './repositories/condition.repository';
import { ConditionImplRepository } from './repositories/impls';

export const CONTROLLERS = [ConditionController];
export const SERVICES_PROVIDERS = [ConditionService];
export const SERVICES_EXPORTS = [ConditionService];

export const REPOSITORY_PROVIDERS: Provider[] = [
  {
    provide: CONDITION_REPOSITORY_TOKEN,
    useClass: ConditionImplRepository,
  },
];
