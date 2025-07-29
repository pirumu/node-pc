import { BaseController } from '@framework/controller';
import { ApiDocs, ControllerDocs } from '@framework/swagger';
import { Body, Controller, Post, Headers } from '@nestjs/common';

import { DEVICE_ID_KEY } from '../../../common';

import { RegisterTabletRequestDto } from './dtos/request';
import { RegisterTabletResponse } from './dtos/response';
import { TabletService } from './tablet.service';
import { TABLET_ROUTES } from './user.constants';

@ControllerDocs({
  tag: '[SYSTEM] Tablet',
})
@Controller(TABLET_ROUTES.GROUP)
export class TabletController extends BaseController {
  constructor(private readonly _tabletService: TabletService) {
    super();
  }

  @ApiDocs({
    responseSchema: RegisterTabletResponse,
  })
  @Post(TABLET_ROUTES.REGISTER)
  public async register(@Body() body: RegisterTabletRequestDto, @Headers(DEVICE_ID_KEY) deviceId: string): Promise<RegisterTabletResponse> {
    const deviceKey = await this._tabletService.register(body, deviceId);
    return new RegisterTabletResponse({
      privateKey: deviceKey,
    });
  }
}
