import { Provider } from '@nestjs/common';

import { ConditionController } from './condition.controller';
import { ConditionService } from './condition.service';

export const CONTROLLERS = [ConditionController];
export const SERVICES_PROVIDERS = [ConditionService];
export const SERVICES_EXPORTS = [ConditionService];

export const REPOSITORY_PROVIDERS: Provider[] = [];
