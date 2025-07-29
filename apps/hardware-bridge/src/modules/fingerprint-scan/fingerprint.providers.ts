import { FingerprintScanService } from '@fingerprint-scanner';
import { Provider } from '@nestjs/common';

import { FingerprintScanController } from './fingerprint-scan.controller';
import { FINGERPRINT_REPOSITORY_TOKEN } from './repositories';
import { FingerprintImplRepository } from './repositories/impls';

export const CONTROLLERS = [FingerprintScanController];
export const SERVICES_PROVIDERS = [FingerprintScanService];
export const SERVICES_EXPORTS = [];

export const REPOSITORY_PROVIDERS: Provider[] = [
  {
    provide: FINGERPRINT_REPOSITORY_TOKEN,
    useClass: FingerprintImplRepository,
  },
];
