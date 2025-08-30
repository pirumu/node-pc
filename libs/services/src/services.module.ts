import { HttpModule, HttpClientType } from '@framework/http-client';
import { Global, Module } from '@nestjs/common';

import { CloudService } from './cloud/cloud.service';

@Global()
@Module({
  imports: [
    HttpModule.forRegisterAsync({
      useFactory: () => {
        return {
          clientType: HttpClientType.FETCH,
          clientOptions: {
            baseURL: '',
            timeout: 3000,
          },
        };
      },
    }),
  ],
  providers: [CloudService],
  exports: [CloudService],
})
export class ServicesModule {}
