import { Provider } from '@nestjs/common';

import { BinController } from './bin.controller';
import { BinService } from './bin.service';
import { BIN_REPOSITORY_TOKEN } from './repositories';
import { BinImplRepository } from './repositories/impls';

export const CONTROLLERS = [BinController];
export const SERVICES_PROVIDERS = [BinService];
export const SERVICES_EXPORTS = [BinService];

export const REPOSITORY_PROVIDERS: Provider[] = [
  {
    provide: BIN_REPOSITORY_TOKEN,
    useClass: BinImplRepository,
  },
];
