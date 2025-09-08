import { Provider } from '@nestjs/common';

import { BinEventController } from './bin-event.controller';
import { BinController } from './bin.controller';
import { BinService } from './bin.service';

export const CONTROLLERS = [BinController, BinEventController];
export const SERVICES_PROVIDERS = [BinService];
export const SERVICES_EXPORTS = [BinService];

export const REPOSITORY_PROVIDERS: Provider[] = [];
