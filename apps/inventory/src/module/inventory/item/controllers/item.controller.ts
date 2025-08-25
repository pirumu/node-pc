import { AuthUser } from '@common/decorator';
import { AuthUserDto, PaginationResponse } from '@common/dto';
import { BaseController } from '@framework/controller';
import { ApiDocs, ControllerDocs } from '@framework/swagger';
import { Body, Controller, Get, Post, Query } from '@nestjs/common';

import { GetItemRequest, ItemRequest } from '../dtos/request';
import {
  GetItemTypesResponse,
  ProcessingItemResponse,
  IssuableItemResponse,
  ReplenishableItemResponse,
  ReturnableItemResponse,
} from '../dtos/response';
import { ITEM_ROUTES } from '../item.constants';
import { IssueItemService, ItemService, ReplenishItemService, ReturnItemService } from '../services';

@ControllerDocs({
  tag: 'Item',
  // securitySchema: 'bearer', // bearer and header
  // securityKey: HEADER_KEYS.DEVICE_KEY,
})
@Controller(ITEM_ROUTES.GROUP)
export class ItemController extends BaseController {
  constructor(
    private readonly _itemService: ItemService,
    private readonly _issueItemService: IssueItemService,
    private readonly _returnItemService: ReturnItemService,
    private readonly _replenishItemService: ReplenishItemService,
  ) {
    super();
  }

  @ApiDocs({
    summary: 'Get issuable items',
    paginatedResponseSchema: IssuableItemResponse,
  })
  @Get(ITEM_ROUTES.ISSUE)
  public async getIssuableItems(@Query() query: GetItemRequest): Promise<PaginationResponse<IssuableItemResponse>> {
    const { rows, meta } = await this._issueItemService.getIssuableItems(query);
    const data = rows.map((row) => this.toDto<IssuableItemResponse>(IssuableItemResponse, row));
    return new PaginationResponse(data, meta);
  }

  @ApiDocs({
    summary: 'Get returnable items',
    paginatedResponseSchema: ReturnableItemResponse,
  })
  @Get(ITEM_ROUTES.RETURN)
  public async getReturnableItems(
    @AuthUser() authUser: AuthUserDto,
    @Query() query: GetItemRequest,
  ): Promise<PaginationResponse<ReturnableItemResponse>> {
    const { rows, meta } = await this._returnItemService.getReturnableItems(authUser.id, query);
    const data = rows.map((row) => this.toDto<ReturnableItemResponse>(ReturnableItemResponse, row));
    return new PaginationResponse(data, meta);
  }

  @ApiDocs({
    summary: 'Get replenishable items',
    paginatedResponseSchema: ReplenishableItemResponse,
  })
  @Get(ITEM_ROUTES.REPLENISH)
  public async getReplenishableItems(@Query() query: GetItemRequest): Promise<PaginationResponse<ReplenishableItemResponse>> {
    const { rows, meta } = await this._replenishItemService.getReplenishableItems(query);
    const data = rows.map((row) => this.toDto<ReplenishableItemResponse>(ReplenishableItemResponse, row));
    return new PaginationResponse(data, meta);
  }

  @ApiDocs({
    summary: 'Issue items',
    responseSchema: ProcessingItemResponse,
  })
  @Post(ITEM_ROUTES.ISSUE)
  public async issue(@AuthUser() user: AuthUserDto, @Body() body: ItemRequest): Promise<ProcessingItemResponse> {
    const result = await this._issueItemService.issue(user, body);
    return this.toDto<ProcessingItemResponse>(ProcessingItemResponse, result);
  }

  @ApiDocs({
    summary: 'Return items',
    responseSchema: ProcessingItemResponse,
  })
  @Post(ITEM_ROUTES.RETURN)
  public async return(@AuthUser() user: AuthUserDto, @Body() body: ItemRequest): Promise<ProcessingItemResponse> {
    const result = await this._returnItemService.return(user, body);
    return this.toDto<ProcessingItemResponse>(ProcessingItemResponse, result);
  }

  @ApiDocs({
    summary: 'Replenish items',
    responseSchema: ProcessingItemResponse,
  })
  @Post(ITEM_ROUTES.REPLENISH)
  public async replenish(@AuthUser() user: AuthUserDto, @Body() body: ItemRequest): Promise<ProcessingItemResponse> {
    const result = await this._replenishItemService.replenish(user, body);
    return this.toDto<ProcessingItemResponse>(ProcessingItemResponse, result);
  }

  @ApiDocs({
    summary: 'Get item types',
    responseSchema: [GetItemTypesResponse],
  })
  @Get(ITEM_ROUTES.TYPES)
  public async getItemTypes(): Promise<GetItemTypesResponse[]> {
    const types = await this._itemService.getAvailableItemTypes();
    return types.map((t) => this.toDto<GetItemTypesResponse>(GetItemTypesResponse, t.toPOJO()));
  }
}
