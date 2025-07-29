import { Provider } from '@nestjs/common';

import { TABLET_REPOSITORY_TOKEN } from './repository';
import { TabletImplRepository } from './repository/impls';
import { TabletController } from './tablet.controller';
import { TabletService } from './tablet.service';

export const CONTROLLERS = [TabletController];
export const SERVICES_PROVIDERS = [TabletService];
export const SERVICES_EXPORTS = [TabletService];

export const REPOSITORY_PROVIDERS: Provider[] = [
  {
    provide: TABLET_REPOSITORY_TOKEN,
    useClass: TabletImplRepository,
  },
];
