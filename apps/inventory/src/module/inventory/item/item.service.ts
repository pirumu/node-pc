import { AuthUserDto } from '@common/dto';
import { BinItemWithIdAndName, IssueItemEntity, WorkOrderItem } from '@entity';
import { AppHttpException } from '@framework/exception';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import { AreaService } from '../area';
import { BinItemService } from '../bin-item';
import { DeviceService } from '../device';
import { JobCardService } from '../job-card';

import { GetItemsRequest, IssueItemRequest } from './dtos/request';
import { IItemRepository, ITEM_REPOSITORY_TOKEN } from './repositories';
import { PROCESS_ITEM_TYPE } from '@common/constants';

@Injectable()
export class ItemService {
  constructor(
    // private readonly _areaService: AreaService,
    private readonly _binItemService: BinItemService,
    // private readonly _jobCardService: JobCardService,
    // private readonly _deviceService: DeviceService,
    @Inject(ITEM_REPOSITORY_TOKEN) private readonly _repository: IItemRepository,
  ) {}

  public async getConfigure(keyword?: string): Promise<BinItemWithIdAndName[]> {
    return this._binItemService.getListBinItem(keyword);
  }

  public async getIssueItems(dto: GetItemsRequest): Promise<IssueItemEntity[]> {
    const dateThreshold = new Date();
    dateThreshold.setHours(0, 0, 0, 0);
    return this._repository.getIssueItems({ ...dto, dateThreshold });
  }

  public async issue(request: IssueItemRequest): Promise<IssueItemEntity[]> {
    const dateThreshold = new Date();
    dateThreshold.setHours(0, 0, 0, 0);
    return this._repository.getItemsForIssue({
      itemIds: request.items.map((i) => i.itemId),
      binIds: request.items.map((i) => i.binId).filter((i) => i !== undefined),
      processBy: '688dc7ee7bc1864fe80de091',
      dateThreshold: dateThreshold,
    });
  }

  // public async issue(processor: AuthUserDto, tabletDeviceId: string, request: IssueItemRequest): Promise<any> {
  //   const dateThreshold = new Date().setHours(0, 0, 0, 0);
  //
  //   const uniqueId = tabletDeviceId;
  //   const { items } = request;
  //
  //   // Extract all itemIds and binIds for batch processing
  //   const requestItemsMap = new Map(items.map((item) => [item.itemId, item]));
  //
  //   let totalRequestQty = 0;
  //   const result: ItemResult[] = [];
  //
  //   const aggregatedItems = [];
  //   for (const requestedItem of items) {
  //     const itemData = aggregatedItems.find((aggItem) => aggItem._id.toString() === requestedItem.itemId);
  //
  //     if (!itemData) {
  //       throw AppHttpException.badRequest({ message: 'Item not found', data: requestItemsMap.get(requestedItem.itemId) });
  //     }
  //
  //     let quantityCalc = 0;
  //     const locations: LocationResult[] = [];
  //     totalRequestQty += requestedItem.quantity;
  //     for (const location of itemData.locations) {
  //       let finalLocation: LocationResult = location.userReturnLocation
  //         ? {
  //             cabinet: location.userReturnLocation.cabinet || location.cabinet,
  //             bin: location.userReturnLocation.bin,
  //             preQty: location.preQty,
  //           }
  //         : {
  //             cabinet: location.cabinet,
  //             bin: location.bin,
  //             preQty: location.preQty,
  //           };
  //
  //       if (requestedItem.quantity - quantityCalc > location.preQty) {
  //         quantityCalc += location.preQty;
  //         finalLocation.requestQty = location.preQty;
  //       } else {
  //         finalLocation.requestQty = requestedItem.quantity - quantityCalc;
  //         locations.push(finalLocation);
  //         break;
  //       }
  //       locations.push(finalLocation);
  //     }
  //
  //     // Format Work Orders
  //     let workOrders: any[] = [];
  //     if (requestedItem.listWO && requestedItem.listWO.length) {
  //       workOrders = await this._repository.e(requestedItem.listWO);
  //       if (!workOrders.length) {
  //         throw AppHttpException.badRequest({ message: 'Invalid work order list', data: requestedItem.listWO });
  //       }
  //     }
  //
  //     result.push({
  //       id: itemData._id.toString(),
  //       name: itemData.name,
  //       itemTypeId: itemData.itemTypeId,
  //       type: itemData.type,
  //       partNo: itemData.partNo,
  //       materialNo: itemData.materialNo,
  //       locations,
  //       listWO: workOrders || [],
  //     });
  //   }
  //   return {
  //     success: true,
  //     data: result,
  //     formattedData,
  //     requestQty: totalRequestQty,
  //   };
  // }

  // private async _processSingleItemForIssue();
  //
  // private async _formatIssueData() {}

  public async getTypeItems(type: PROCESS_ITEM_TYPE) {
    return this._repository.getItemsByType(type);
  }
}
