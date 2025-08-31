import { Provider } from '@nestjs/common';

import { LoadcellPublisherService } from './loadcell-publisher.service';
import { LoadcellController } from './loadcell.controller';
import { LoadcellService } from './loadcell.service';
import { LoadCellEventController } from './loadcell-event.controller';

export const CONTROLLERS = [LoadcellController, LoadCellEventController];
export const SERVICES_PROVIDERS = [LoadcellService, LoadcellPublisherService];
export const SERVICES_EXPORTS = [LoadcellService];

export const REPOSITORY_PROVIDERS: Provider[] = [];
