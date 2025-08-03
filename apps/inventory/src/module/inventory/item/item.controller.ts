import { DEVICE_ID_KEY, PROCESS_ITEM_TYPE } from '@common/constants';
import { AuthUser, TabletDeviceId } from '@common/decorator';
import { AuthUserDto } from '@common/dto';
import { BaseController } from '@framework/controller';
import { ApiDocs, ControllerDocs } from '@framework/swagger';
import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiHeader, ApiQuery } from '@nestjs/swagger';

import { HEADER_KEYS } from '../../../common';

import { GetConfigureRequest, GetItemsRequest, IssueItemRequest } from './dtos/request';
import { GetConfigureResponse, ItemResponse } from './dtos/response';
import { ITEM_ROUTES } from './item.constants';
import { ItemService } from './item.service';

@ControllerDocs({
  tag: '[INVENTORY] Item',
  securitySchema: 'b-h', // bearer and header
  securityKey: HEADER_KEYS.DEVICE_KEY,
})
@Controller(ITEM_ROUTES.GROUP)
export class ItemController extends BaseController {
  constructor(private readonly _itemService: ItemService) {
    super();
  }

  @ApiDocs({
    responseSchema: [ItemResponse],
  })
  @Get(ITEM_ROUTES.ISSUE)
  public async getIssueItems(@Query() dto: GetItemsRequest): Promise<any> {
    const results = await this._itemService.getIssueItems(dto);
    return { rows: results.map((item) => this.toDto<ItemResponse>(ItemResponse, item)), count: results.length };
  }

  @ApiHeader({
    name: DEVICE_ID_KEY,
  })
  @Post(ITEM_ROUTES.ISSUE)
  public issueItem(@Body() body: IssueItemRequest) {
    return this._itemService.issue(body) as any;
  }

  @Get(ITEM_ROUTES.RETURN)
  public getReturnItems(@AuthUser() authUser: AuthUserDto): void {}

  @Post(ITEM_ROUTES.RETURN)
  public returnItem(@AuthUser() authUser: AuthUserDto): void {}

  @Get(ITEM_ROUTES.REPLENISH)
  public getReplenishItems(@AuthUser() authUser: AuthUserDto): void {}

  @Post(ITEM_ROUTES.REPLENISH)
  public replenishItem(@AuthUser() authUser: AuthUserDto): void {}

  @ApiDocs({
    responseSchema: [GetConfigureResponse],
  })
  @Get(ITEM_ROUTES.CONFIGURE)
  public async configure(@Query() dto: GetConfigureRequest): Promise<GetConfigureResponse[]> {
    const entities = await this._itemService.getConfigure(dto.keyword);
    return entities.map((e) => this.toDto<GetConfigureResponse>(GetConfigureResponse, e));
  }

  @ApiDocs({})
  @Get(ITEM_ROUTES.TYPES)
  @ApiQuery({
    name: 'type',
  })
  public async getTypeItems(@Query('type') type: any): Promise<any> {
    return this._itemService.getTypeItems(type);
  }
}
