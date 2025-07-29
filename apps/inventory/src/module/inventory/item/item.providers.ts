import { Provider } from '@nestjs/common';

import { ItemController } from './item.controller';
import { ItemService } from './item.service';
import { ITEM_REPOSITORY_TOKEN } from './repositories';
import { ItemImplRepository } from './repositories/impls';

export const CONTROLLERS = [ItemController];
export const SERVICES_PROVIDERS = [ItemService];
export const SERVICES_EXPORTS = [ItemService];

export const REPOSITORY_PROVIDERS: Provider[] = [
  {
    provide: ITEM_REPOSITORY_TOKEN,
    useClass: ItemImplRepository,
  },
];
