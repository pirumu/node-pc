import { Module } from '@nestjs/common';

import { BinItemService } from './bin-item.service';
import { BIN_ITEM_REPOSITORY_TOKEN } from './repositories';
import { BinItemImplRepository } from './repositories/impls';

@Module({
  providers: [
    BinItemService,
    {
      provide: BIN_ITEM_REPOSITORY_TOKEN,
      useClass: BinItemImplRepository,
    },
  ],
  exports: [BinItemService],
})
export class BinItemModule {}
