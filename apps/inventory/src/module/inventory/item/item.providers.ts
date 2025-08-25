import { Provider } from '@nestjs/common';

import { ItemController } from './controllers/item.controller';
import { ProcessingItemController } from './controllers/processing-item.controller';
import { IssueItemRepository, ReplenishItemRepository, ReturnItemRepository } from './repositories';
import { ItemService, IssueItemService, ReturnItemService, ReplenishItemService, ItemProcessingService } from './services';

export const CONTROLLERS = [ItemController, ProcessingItemController];
export const SERVICES_PROVIDERS = [ItemProcessingService, ItemService, IssueItemService, ReturnItemService, ReplenishItemService];
export const SERVICES_EXPORTS = [ItemProcessingService, ItemService, IssueItemService, ReturnItemService, ReplenishItemService];

export const REPOSITORY_PROVIDERS: Provider[] = [IssueItemRepository, ReturnItemRepository, ReplenishItemRepository];
