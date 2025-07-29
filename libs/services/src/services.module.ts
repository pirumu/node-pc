import { HttpModule, HttpClientType } from '@framework/http-client';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CloudService } from './cloud/cloud.service';

@Global()
@Module({
  imports: [
    HttpModule.forRegisterAsync({
      useFactory: (configService: ConfigService) => {
        return {
          clientType: HttpClientType.FETCH,
          clientOptions: {
            baseURL: '',
            timeout: 3000,
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [CloudService],
  exports: [CloudService],
})
export class ServicesModule {}
