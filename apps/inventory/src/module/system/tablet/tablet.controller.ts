import { StatusResponse } from '@common/dto';
import { BaseController } from '@framework/controller';
import { ApiDocs, ControllerDocs } from '@framework/swagger';
import { Body, Controller, Post } from '@nestjs/common';

import { RegisterTabletRequest } from './dtos/request';
import { TABLET_ROUTES } from './tablet.constants';
import { TabletService } from './tablet.service';

@ControllerDocs({
  tag: ' Tablet',
})
@Controller(TABLET_ROUTES.GROUP)
export class TabletController extends BaseController {
  constructor(private readonly _tabletService: TabletService) {
    super();
  }

  @ApiDocs({
    summary: 'Register tablet',
    description:
      'The client must generate a key pair, store the private key securely, and send the public key in the request body. The server will use this public key to authenticate the device in subsequent API calls by verifying request signatures',
    responseSchema: StatusResponse,
  })
  @Post(TABLET_ROUTES.REGISTER)
  public async register(@Body() body: RegisterTabletRequest): Promise<StatusResponse> {
    const isSuccess = await this._tabletService.register(body);
    return this.toDto<StatusResponse>(StatusResponse, { status: isSuccess });
  }
}
