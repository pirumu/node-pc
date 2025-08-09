import { Provider } from '@nestjs/common';

import { ItemController } from './item.controller';
import { ItemService } from './item.service';
import { CalculationService, ItemProcessingService } from './processors';
import { ITEM_REPOSITORY_TOKEN, PROCESS_ITEM_REPOSITORY_TOKEN } from './repositories';
import { ItemImplRepository, ProcessItemImplRepository } from './repositories/impls';

export const CONTROLLERS = [ItemController];
export const SERVICES_PROVIDERS = [ItemService, ItemProcessingService, CalculationService];
export const SERVICES_EXPORTS = [ItemService, ItemProcessingService, CalculationService];

export const REPOSITORY_PROVIDERS: Provider[] = [
  {
    provide: ITEM_REPOSITORY_TOKEN,
    useClass: ItemImplRepository,
  },
  {
    provide: PROCESS_ITEM_REPOSITORY_TOKEN,
    useClass: ProcessItemImplRepository,
  },
];
