import { BaseController } from '@framework/controller';
import { ApiDocs, ControllerDocs } from '@framework/swagger';
import { Controller, Get } from '@nestjs/common';

import { HEADER_KEYS } from '../../../common';

import { CONDITION_ROUTES } from './condition.constants';
import { ConditionService } from './condition.service';
import { GetConditionsResponse } from './dtos/response';

@ControllerDocs({
  tag: '[INVENTORY] Condition',
  securitySchema: 'header',
  securityKey: HEADER_KEYS.DEVICE_KEY,
})
@Controller(CONDITION_ROUTES.GROUP)
export class ConditionController extends BaseController {
  constructor(private readonly _service: ConditionService) {
    super();
  }

  @ApiDocs({
    responseSchema: [GetConditionsResponse],
  })
  @Get(CONDITION_ROUTES.GET_CONDITIONS)
  public async getConditions(): Promise<GetConditionsResponse[]> {
    const results = await this._service.getConditions('');
    return results.map((item) => this.toDto<GetConditionsResponse>(GetConditionsResponse, item));
  }
}
