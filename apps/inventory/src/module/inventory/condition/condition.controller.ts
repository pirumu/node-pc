import { BaseController } from '@framework/controller';
import { ApiDocs, ControllerDocs } from '@framework/swagger';
import { Controller, Get, Query } from '@nestjs/common';

import { HEADER_KEYS } from '../../../common';

import { CONDITION_ROUTES } from './condition.constants';
import { ConditionService } from './condition.service';
import { GetConditionsRequest } from './dtos/request';
import { GetConditionsResponse } from './dtos/response';

@ControllerDocs({
  tag: 'Condition',
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
  public async getConditions(@Query() query: GetConditionsRequest): Promise<GetConditionsResponse[]> {
    const results = await this._service.getConditions(query.siteId, query.excludeName);
    return results.map((item) => this.toDto<GetConditionsResponse>(GetConditionsResponse, item.toPOJO()));
  }
}
