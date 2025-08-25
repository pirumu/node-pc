import { Provider } from '@nestjs/common';

import { LoadcellBridgeService } from './loadcell-bridge.service';
import { LoadcellController } from './loadcell.controller';

export const CONTROLLERS = [LoadcellController];
export const SERVICES_PROVIDERS = [LoadcellBridgeService];
export const SERVICES_EXPORTS = [];

export const REPOSITORY_PROVIDERS: Provider[] = [];
