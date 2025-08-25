import { Provider } from '@nestjs/common';

import { BinController } from './bin.controller';
import { BinService } from './bin.service';

export const CONTROLLERS = [BinController];
export const SERVICES_PROVIDERS = [BinService];
export const SERVICES_EXPORTS = [BinService];

export const REPOSITORY_PROVIDERS: Provider[] = [];
