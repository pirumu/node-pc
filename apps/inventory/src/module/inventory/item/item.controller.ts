import { DEVICE_ID_KEY, EVENT_TYPE } from '@common/constants';
import { AuthUser } from '@common/decorator';
import { AuthUserDto } from '@common/dto';
import { BaseController } from '@framework/controller';
import { PublisherService, Transport } from '@framework/publisher';
import { ApiDocs, ControllerDocs } from '@framework/swagger';
import { Body, Controller, Get, Headers, Post, Query } from '@nestjs/common';
import { ApiHeader, ApiQuery } from '@nestjs/swagger';
import { ClsServiceManager } from 'nestjs-cls';

import { HEADER_KEYS } from '../../../common';

import { GetConfigureRequest, GetItemsRequest, GetItemTypesRequest, ItemRequest, ProcessNextItemRequest } from './dtos/request';
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
  constructor(
    private readonly _itemService: ItemService,
    private readonly _publisherService: PublisherService,
  ) {
    super();
  }

  @ApiDocs({
    responseSchema: [ItemResponse],
  })
  @Get(ITEM_ROUTES.ISSUE)
  public async getIssuableItems(@Query() dto: GetItemsRequest) {
    const requestId = ClsServiceManager.getClsService().getId();
    return this._itemService.getIssuableItems(dto);
  }

  @ApiHeader({
    name: DEVICE_ID_KEY,
  })
  @Post(ITEM_ROUTES.ISSUE)
  public async issue(@AuthUser() user: AuthUserDto, @Headers(DEVICE_ID_KEY) tabletDeviceId: string, @Body() body: ItemRequest) {
    return this._itemService.issue(user, tabletDeviceId, body);
  }

  @Get(ITEM_ROUTES.RETURN)
  public async getReturnableItems(@AuthUser() authUser: AuthUserDto, @Query() dto: GetItemsRequest) {
    return this._itemService.getReturnableItems(authUser.id, dto);
  }

  @Post(ITEM_ROUTES.RETURN)
  public async return(@AuthUser() user: AuthUserDto, @Headers(DEVICE_ID_KEY) tabletDeviceId: string, @Body() body: ItemRequest) {
    return this._itemService.return(user, tabletDeviceId, body);
  }

  @Get(ITEM_ROUTES.REPLENISH)
  public async getReplenishItems(@Query() dto: GetItemsRequest) {
    return this._itemService.getReplenishableItems(dto);
  }

  @Post(ITEM_ROUTES.REPLENISH)
  public async replenish(@AuthUser() user: AuthUserDto, @Headers(DEVICE_ID_KEY) tabletDeviceId: string, @Body() body: ItemRequest) {
    return this._itemService.replenish(user, tabletDeviceId, body);
  }

  @ApiDocs({
    responseSchema: [GetConfigureResponse],
  })
  @Get(ITEM_ROUTES.CONFIGURE)
  public async configure(@Query() dto: GetConfigureRequest) {
    return this._itemService.getBinItemCombinations(dto.keyword);
  }

  @ApiDocs({})
  @Get(ITEM_ROUTES.TYPES)
  public async getTypeItems(@Query() query: GetItemTypesRequest) {
    const types = await this._itemService.getAvailableItemTypes(query.type);
    return types.map((t) => ({
      type: t,
    }));
  }

  @ApiDocs({})
  @Post(ITEM_ROUTES.NEXT_ITEM)
  public async forceNextItem(@Body() body: ProcessNextItemRequest) {
    const { isNextRequestItem } = body;
    return this._publisherService.publish(Transport.MQTT, EVENT_TYPE.CONFIRM_PROCESS, { isCloseWarningPopup: true, isNextRequestItem });
  }
}
