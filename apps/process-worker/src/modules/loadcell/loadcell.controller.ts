import { WeightCalculatedEvent } from '@common/business/events';
import { EVENT_TYPE } from '@common/constants';
import { LoadcellEntity } from '@dals/mongo/entities';
import { PublisherService, Transport } from '@framework/publisher';
import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

import { LoadcellService } from './loadcell.service';

@Controller()
export class LoadcellController {
  constructor(
    private readonly _loadcellService: LoadcellService,
    private readonly _publisherService: PublisherService,
  ) {}

  @EventPattern(EVENT_TYPE.LOADCELL.WEIGHT_CALCULATED)
  public async onWeighCalculated(@Payload() event: WeightCalculatedEvent): Promise<any> {
    const loadcells = await this._loadcellService.onWeighCalculated([event]);
    this._emitChanges(loadcells);
  }

  private _emitChanges(loadcells: LoadcellEntity[]) {
    for (const lc of loadcells) {
      this._publisherService
        .publish(
          Transport.MQTT,
          EVENT_TYPE.LOADCELL.QUANTITY_CALCULATED,
          {
            itemId: lc.item?.id,
            loadcellId: lc.id,
            hardwareId: lc.hardwareId,
            changeInQuantity: lc.liveReading.pendingChange,
          },
          {},
          { async: true },
        )
        .catch((e: Error) => {
          Logger.warn('emit quantity calculated error', e, LoadcellController.name);
          // skip
        });
    }
  }
}
