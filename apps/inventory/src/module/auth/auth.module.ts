import { Module } from '@nestjs/common';

import { TabletModule } from '../system/tablet';
import { UserModule } from '../user';
import { WsModule } from '../ws';

import { CONTROLLERS, SERVICES_PROVIDERS } from './auth.providers';

// import { FingerprintModule } from '../system/fingerprint';

@Module({
  imports: [UserModule, TabletModule, WsModule],
  controllers: [...CONTROLLERS],
  providers: [...SERVICES_PROVIDERS],
  exports: [...SERVICES_PROVIDERS],
})
export class AuthModule {}
