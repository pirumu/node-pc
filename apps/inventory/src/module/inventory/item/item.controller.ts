import { DEVICE_ID_KEY } from '@common/constants';
import { AuthUser, TabletDeviceId } from '@common/decorator';
import { AuthUserDto } from '@common/dto';
import { BaseController } from '@framework/controller';
import { ApiDocs, ControllerDocs } from '@framework/swagger';
import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';

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
  public async getIssueItems(@AuthUser() authUser: AuthUserDto, @Query() dto: GetItemsRequest): Promise<ItemResponse[]> {
    const results = await this._itemService.getIssueItems(dto);
    return results.map((item) => this.toDto<ItemResponse>(ItemResponse, item));
  }

  @ApiHeader({
    name: DEVICE_ID_KEY,
  })
  @Post(ITEM_ROUTES.ISSUE)
  public issueItem(@TabletDeviceId() tabletDeviceId: string, @AuthUser() authUser: AuthUserDto, @Body() body: IssueItemRequest): void {
    return this._itemService.issueItems(tabletDeviceId, authUser, body);
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
}
