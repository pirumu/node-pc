import { Provider } from '@nestjs/common';

import { AreaController } from './area.controller';
import { AreaService } from './area.service';

export const CONTROLLERS = [AreaController];
export const SERVICES_PROVIDERS = [AreaService];
export const SERVICES_EXPORTS = [AreaService];

export const REPOSITORY_PROVIDERS: Provider[] = [];
