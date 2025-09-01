import { Module } from '@nestjs/common';

import { WsModule } from '../../ws';

import { WorkingOrderController } from './working-order.controller';
import { WorkingOrderService } from './working-order.service';

@Module({
  imports: [WsModule],
  controllers: [WorkingOrderController],
  providers: [WorkingOrderService],
  exports: [WorkingOrderService],
})
export class WorkingOrderModule {}
