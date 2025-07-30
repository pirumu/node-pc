import { Provider } from '@nestjs/common';

import { FingerprintController } from './fingerprint.controller';
import { FingerprintService } from './fingerprint.service';
import { FINGERPRINT_REPOSITORY_TOKEN } from './repositories';
import { FingerprintImplRepository } from './repositories/impls';

export const CONTROLLERS = [FingerprintController];
export const SERVICES_PROVIDERS = [FingerprintService];
export const SERVICES_EXPORTS = [FingerprintService];

export const REPOSITORY_PROVIDERS: Provider[] = [
  {
    provide: FINGERPRINT_REPOSITORY_TOKEN,
    useClass: FingerprintImplRepository,
  },
];
