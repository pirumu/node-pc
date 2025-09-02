import { EVENT_TYPE } from '@common/constants';
import { StatusResponse } from '@common/dto';
import { BaseController } from '@framework/controller';
import { PublisherService, Transport } from '@framework/publisher';
import { ApiDocs, ControllerDocs } from '@framework/swagger';
import { Body, Controller, Post } from '@nestjs/common';

import { ProcessNextItemRequest } from '../dtos/request';
import { PROCESSING_ITEM_ROUTES } from '../item.constants';

@ControllerDocs({
  tag: `Processing Item`,
})
@Controller(PROCESSING_ITEM_ROUTES.GROUP)
export class ProcessingItemController extends BaseController {
  constructor(private readonly _publisherService: PublisherService) {
    super();
  }

  @ApiDocs({
    summary: 'Force next processing item',
    description: `
      Force proceed to next item in processing queue when current item encounters errors.
          
      During item processing (issue/return/replenish), the system may encounter various errors such as:
      - Calibration failures
      - Hardware malfunctions  
      - Weight discrepancies
      - Timeout issues
      - User intervention needed
      
      This endpoint allows operators to manually skip the problematic item and continue with the next item in the processing queue, preventing the entire transaction from being blocked.
      
      Behavior:
      - Closes any active warning popups in the UI
      - Signals the processing system to move to next item
      - Maintains transaction integrity by logging the skip action
      - Optionally processes next request item based on parameter
      
      Safety Notes:
      - Should only be used after proper verification of the issue
      - May require manual inventory reconciliation for skipped items
      - Transaction audit trail will reflect the forced skip action
  `,
    responseSchema: StatusResponse,
  })
  @Post(PROCESSING_ITEM_ROUTES.FORCE_NEXT_STEP)
  public async forceNextItem(@Body() body: ProcessNextItemRequest): Promise<StatusResponse> {
    await this._publisherService.publish(
      Transport.MQTT,
      EVENT_TYPE.PROCESS.FORCE_NEXT_STEP,
      {
        transactionId: body.transactionId,
        isCloseWarningPopup: true,
        isNextRequestItem: body.isNextRequestItem,
      },
      {},
      { async: true },
    );
    return this.toDto<StatusResponse>(StatusResponse, { status: true });
  }
}
