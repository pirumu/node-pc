import { PROCESS_ITEM_TYPE } from '@common/constants';
import { AuthUserDto } from '@common/dto';
import { AppHttpException } from '@framework/exception';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { ItemRequest } from './dtos/request';
import { InputItem, InputLocation, ProcessDataResult, ProcessItemData, WorkingOrderData } from './item.types';
import { ItemProcessingService } from './processors';
import { IItemRepository, ITEM_REPOSITORY_TOKEN } from './repositories';

@Injectable()
export class ItemService {
  private readonly _logger = new Logger(ItemService.name);

  constructor(
    private readonly _itemProcessingService: ItemProcessingService,
    @Inject(ITEM_REPOSITORY_TOKEN) private readonly _repository: IItemRepository,
  ) {}

  public async getIssuableItems(query: any) {
    const { page = 1, limit = 100, keyword, type } = query;

    const expiryDate = new Date().setHours(0, 0, 0, 0);

    const { rows, total } = await this._repository.findIssuableItems({
      page,
      limit,
      keyword,
      type,
      expiryDate,
    });

    const data = rows.map((row) => ({
      id: row.id,
      name: row.name,
      partNo: row.partNo,
      materialNo: row.materialNo,
      itemTypeId: row.itemTypeId,
      type: row.type,
      image: row.image,
      description: row.description,
      totalQuantity: row.totalQuantity,
      totalCalcQuantity: row.totalCalcQuantity,
      locations: [row.binName],
      binId: row.binId,
      dueDate: row.dueDate,
    }));

    return {
      rows: data,
      count: total,
    };
  }
  public async issue(user: AuthUserDto, tabletDeviceId: string, dto: ItemRequest) {
    const { items: itemsFromRequest } = dto;
    const currentDate = new Date().setHours(0, 0, 0, 0);

    const pairs = itemsFromRequest.map((item) => ({
      itemId: item.itemId,
      binId: item.binId,
    }));

    const [dataForIssue, workingOrderMap, clusterId] = await Promise.all([
      this._repository.findItemsForIssue({
        userId: user.id,
        expiryDate: currentDate,
        pairs,
      }),
      this._prepareWorkingOrderRequest(itemsFromRequest),
      this._repository.findClusterIdForProcess(tabletDeviceId),
    ]);

    if (!clusterId) {
      throw AppHttpException.badRequest({ message: 'Unknown tablet request.' });
    }

    if (dataForIssue.length < pairs.length) {
      throw AppHttpException.badRequest({ message: 'One or more requested items are invalid or unavailable.' });
    }
    const requestDataMap = new Map(itemsFromRequest.map((item) => [`${item.itemId}-${item.binId}`, item]));

    const result: InputItem[] = [];
    let requestQty = 0;

    for (const data of dataForIssue) {
      const { item, bin, cabinet, returnItem, devices } = data;
      const originalRequest = requestDataMap.get(`${item.id}-${bin.id}`);
      if (!originalRequest) {
        continue;
      }

      const quantityToIssue = originalRequest.quantity;
      requestQty += quantityToIssue;

      let quantityCalc = 0;
      const locations = [];

      devices.sort((a, b) => (a.binId as string).localeCompare(b.binId as string));
      for (const device of devices) {
        if (quantityCalc >= quantityToIssue) {
          break;
        }

        let location: InputLocation = {
          cabinet: { id: cabinet.id, name: cabinet.name },
          bin: {
            id: bin.id,
            name: bin.name,
            row: bin.row,
            cuId: bin.cuId,
            lockId: bin.lockId,
          },
          preQty: device.quantity,
          requestQty: 0,
        };

        if (returnItem && returnItem.locations?.length) {
          const existingLocation = returnItem.locations.find((loc) => loc.bin.id === bin.id);
          if (existingLocation) {
            location = { ...existingLocation, preQty: device.quantity, requestQty: 0 };
          }
        }

        const availableQty = device.quantity;
        const neededQty = quantityToIssue - quantityCalc;
        const qtyToTake = Math.min(availableQty, neededQty);
        location.requestQty = qtyToTake;
        locations.push(location);
        quantityCalc += qtyToTake;
      }
      if (quantityCalc < quantityToIssue) {
        throw AppHttpException.badRequest({
          message: `Not enough stock for item ${item.name}. Requested: ${quantityToIssue}, Available: ${quantityCalc}`,
        });
      }

      const workingOrders: WorkingOrderData[] = [];
      if (originalRequest.workingOrders && originalRequest.workingOrders.length) {
        for (const wo of originalRequest.workingOrders) {
          const workingOrder = workingOrderMap.get(`${wo.woId}-${wo.areaId}`);
          if (workingOrder) {
            workingOrders.push(workingOrder);
          }
        }
        if (!workingOrders.length) {
          throw AppHttpException.badRequest({ message: 'Wrong work order format.' });
        }
      }

      result.push({
        id: item.id,
        name: item.name,
        itemTypeId: item.itemTypeId,
        type: item.type,
        partNo: item.partNo,
        materialNo: item.materialNo,
        locations,
        workingOrders: workingOrders,
        conditionId: null,
      });
    }

    const processInput = await this._prepareDataForProcessRequest(result);

    this._itemProcessingService
      .start({
        transactionType: PROCESS_ITEM_TYPE.ISSUE,
        data: processInput,
        user: {
          id: user.id,
          loginId: user.loginId,
          cloudId: user.userCloudId || '1',
          role: user.role,
        },
        clusterId: clusterId,
        requestQty: requestQty,
      })
      .catch((err) => {
        this._logger.error(err);
      });

    return dataForIssue;
  }

  public async getReturnableItems(userId: string, query: any) {
    const { page = 1, limit = 100, keyword, type } = query;

    const { rows, total } = await this._repository.findReturnableItems({
      userId,
      page,
      limit,
      keyword,
      type,
    });

    return {
      rows: rows,
      count: total,
    };
  }
  public async return(user: AuthUserDto, tabletDeviceId: string, dto: ItemRequest) {
    const { items: itemsFromRequest } = dto;

    const pairs = itemsFromRequest.map((item) => ({
      itemId: item.itemId,
      binId: item.binId,
    }));

    const [dataForReturn, workingOrderMap, clusterId] = await Promise.all([
      this._repository.findItemsForReturn({
        userId: user.id,
        pairs,
      }),
      this._prepareWorkingOrderRequest(itemsFromRequest),
      this._repository.findClusterIdForProcess(tabletDeviceId),
    ]);

    if (!clusterId) {
      throw AppHttpException.badRequest({ message: 'Unknown tablet request.' });
    }

    if (dataForReturn.length < pairs.length) {
      throw AppHttpException.badRequest({ message: 'One or more items are not eligible for return.' });
    }

    const returnDataMap = new Map(dataForReturn.map((data) => [`${data.item.id}-${data.returnItem.binId}`, data]));

    const result: InputItem[] = [];
    let requestQty = 0;

    for (const originalRequest of itemsFromRequest) {
      const key = `${originalRequest.itemId}-${originalRequest.binId}`;
      const data = returnDataMap.get(key);
      if (!data) {
        continue;
      }

      const { returnItem, item, devices } = data;
      const quantityToReturn = originalRequest.quantity;
      requestQty += quantityToReturn;

      let quantityCalc = 0;
      const locations: InputLocation[] = [];

      const deviceMap = new Map(devices.map((d) => [`${d.itemId}-${d.binId}`, d]));

      for (const location of returnItem.locations) {
        if (quantityCalc >= quantityToReturn) {
          break;
        }
        if (location.quantity === 0) {
          continue;
        }

        const device = deviceMap.get(`${item.id}-${location.bin.id}`);
        const preQty = device ? device.quantity : 0;

        const availableQty = location.quantity;
        const neededQty = quantityToReturn - quantityCalc;
        const qtyToTake = Math.min(availableQty, neededQty);

        locations.push({
          ...location,
          preQty: preQty,
          requestQty: qtyToTake,
        });

        quantityCalc += qtyToTake;
        location.quantity -= qtyToTake;
      }

      if (quantityCalc < quantityToReturn) {
        throw AppHttpException.badRequest({
          message: `Invalid quantity for item ${item.name}. Requested: ${quantityToReturn}, Available to return: ${quantityCalc}`,
        });
      }
      returnItem.quantity -= quantityCalc;
      const workingOrders: WorkingOrderData[] = [];
      if (originalRequest.workingOrders && originalRequest.workingOrders.length) {
        for (const wo of originalRequest.workingOrders) {
          const workingOrder = workingOrderMap.get(`${wo.woId}-${wo.areaId}`);
          if (!workingOrder) {
            throw AppHttpException.badRequest({
              message: `Invalid Work Order or Area ID provided for item ${item.name}: woId=${wo.woId}, areaId=${wo.areaId}`,
            });
          }
          workingOrders.push(workingOrder);
        }
      }

      result.push({
        id: item.id,
        name: item.name,
        itemTypeId: item.itemTypeId,
        type: item.type,
        partNo: item.partNo,
        materialNo: item.materialNo,
        locations,
        workingOrders: workingOrders,
        conditionId: originalRequest.conditionId,
      });
    }

    const processInput = await this._prepareDataForProcessRequest(result);

    this._itemProcessingService
      .start({
        transactionType: PROCESS_ITEM_TYPE.RETURN,
        data: processInput,
        user: {
          id: user.id,
          loginId: user.loginId,
          cloudId: user.userCloudId,
          role: user.role,
        },
        clusterId: clusterId,
        requestQty: requestQty,
      })
      .catch((err) => {
        this._logger.error(err);
      });

    return dataForReturn;
  }

  public async getReplenishableItems(query: any) {
    const { page = 1, limit = 100, keyword, type } = query;
    const { rows, total } = await this._repository.findReplenishableItems({
      page,
      limit,
      keyword,
      type,
    });
    return {
      rows,
      count: total,
    };
  }
  public async replenish(user: AuthUserDto, tabletDeviceId: string, dto: ItemRequest) {
    const { items: itemsFromRequest } = dto;

    const pairs = itemsFromRequest.map((item) => ({
      itemId: item.itemId,
      binId: item.binId,
    }));

    const [dataForReplenish, clusterId] = await Promise.all([
      this._repository.findItemsForReplenish({ pairs }),
      this._repository.findClusterIdForProcess(tabletDeviceId),
    ]);

    if (!clusterId) {
      throw AppHttpException.badRequest({ message: 'Unknown tablet request.' });
    }

    if (dataForReplenish.length === 0) {
      throw AppHttpException.badRequest({ message: 'No items found that require replenishment for the specified bins.' });
    }

    const replenishDataMap = new Map(dataForReplenish.map((data) => [data.item.id, data]));

    const result: InputItem[] = [];
    let requestQty = 0;

    for (const originalRequest of itemsFromRequest) {
      const data = replenishDataMap.get(originalRequest.itemId);

      if (!data) {
        continue;
      }

      const { item, devices } = data;
      const quantityToReplenish = originalRequest.quantity;
      requestQty += quantityToReplenish;

      let quantityCalc = 0;
      const locations: InputLocation[] = [];

      devices.sort((a, b) => (a.binId as string).localeCompare(b.binId as string));

      for (const device of devices) {
        if (quantityCalc >= quantityToReplenish) {
          break;
        }

        const quantityLeft = device.calcQuantity - device.quantity;
        if (quantityLeft <= 0) {
          continue;
        }

        const neededQty = quantityToReplenish - quantityCalc;

        const amountToFill = Math.min(neededQty, quantityLeft);

        locations.push({
          cabinet: { id: device.cabinet.id, name: device.cabinet.name },
          bin: {
            id: device.bin.id,
            name: device.bin.name,
            row: device.bin.row,
            cuId: device.bin.cuId,
            lockId: device.bin.lockId,
          },
          preQty: device.quantity,
          requestQty: amountToFill,
        });

        quantityCalc += amountToFill;
      }

      if (quantityCalc < quantityToReplenish) {
        // Todo: need throw exception.
        this._logger.warn(
          `Could not fully allocate replenishment for ${item.name}. Requested: ${quantityToReplenish}, Allocated: ${quantityCalc}`,
        );
      }

      result.push({
        id: item.id,
        name: item.name,
        itemTypeId: item.itemTypeId,
        type: item.type,
        partNo: item.partNo,
        materialNo: item.materialNo,
        locations,
        workingOrders: [],
        conditionId: null,
      });
    }

    const processInput = await this._prepareDataForProcessRequest(result);

    this._itemProcessingService
      .start({
        transactionType: PROCESS_ITEM_TYPE.REPLENISH,
        data: processInput,
        user: {
          id: user.id,
          loginId: user.loginId,
          cloudId: user.userCloudId,
          role: user.role,
        },
        clusterId: clusterId,
        requestQty: requestQty,
      })
      .catch((err) => {
        this._logger.error(err);
      });

    return dataForReplenish;
  }

  private async _prepareWorkingOrderRequest(itemsFromRequest: ItemRequest['items']): Promise<Map<string, WorkingOrderData>> {
    const workingOrderRequests = itemsFromRequest.flatMap((item) => item.workingOrders || []);
    const resultMap = new Map<string, WorkingOrderData>();

    if (workingOrderRequests.length === 0) {
      return resultMap;
    }

    const woIds = [...new Set(workingOrderRequests.map((item) => item.woId))];
    const areaIds = [...new Set(workingOrderRequests.map((item) => item.areaId))];

    const { jobCards, areas } = await this._repository.findJobCardsAndAreas(woIds, areaIds);

    const jobCardMap = new Map(jobCards.map((jc) => [jc.id, jc]));
    const areaMap = new Map(areas.map((a) => [a.id, a]));

    const result = workingOrderRequests.map((item) => {
      const jobCard = jobCardMap.get(item.woId);
      const area = areaMap.get(item.areaId);
      if (!jobCard || !area) {
        this._logger.warn(`Could not find job card or area for woId: ${item.woId}, areaId: ${item.areaId}`);
        return null;
      }
      return {
        woId: jobCard.id,
        wo: jobCard.wo,
        vehicleId: jobCard.vehicleId,
        platform: jobCard.platform,
        areaId: area.id,
        torq: area.torque,
        area: area.name,
      } as WorkingOrderData;
    });

    result.forEach((item) => {
      if (item !== null) {
        resultMap.set(`${item.woId}-${item.areaId}`, item);
      }
    });
    return resultMap;
  }
  private async _prepareDataForProcessRequest(data: InputItem[]): Promise<ProcessDataResult[]> {
    if (!data || data.length === 0) {
      return [];
    }

    const itemsByBin: { [key: string]: ProcessDataResult } = {};
    const allBinIds = new Set<string>();

    for (const item of data) {
      for (const location of item.locations) {
        const binId = location.bin.id.toString();
        allBinIds.add(binId);
        if (!itemsByBin[binId]) {
          itemsByBin[binId] = {
            cabinet: location.cabinet,
            bin: location.bin,
            requestItems: [],
            storageItems: [],
          };
        }
        const itemData: ProcessItemData = {
          id: item.id,
          name: item.name,
          itemTypeId: item.itemTypeId,
          type: item.type,
          partNo: item.partNo,
          materialNo: item.materialNo,
          requestQty: location.requestQty,
          preQty: location.preQty,
          conditionName: item.conditionId,
          workingOrders: item.workingOrders,
          status: null,
        };
        itemsByBin[binId].requestItems.push(itemData);
      }
    }

    const allDevicesInBins = await this._repository.findDevicesWithItemByBinIds([...allBinIds]);

    const requestedItemIdsByBin: { [key: string]: Set<string> } = {};
    for (const binId of allBinIds) {
      requestedItemIdsByBin[binId] = new Set(itemsByBin[binId].requestItems.map((item) => item.id.toString()));
    }

    allDevicesInBins.forEach(({ device, item }) => {
      if (!item) {
        return;
      }
      const binId = device.binId as string;
      const itemId = device.itemId as string;

      if (itemsByBin[binId] && !requestedItemIdsByBin[binId].has(itemId)) {
        const storageItemData: ProcessItemData = {
          id: item.id,
          name: item.name,
          itemTypeId: item.itemTypeId,
          type: item.type,
          partNo: item.partNo,
          materialNo: item.materialNo,
          requestQty: 0,
          workingOrders: [],
          preQty: device.quantity,
          status: null,
          conditionName: null,
        };
        itemsByBin[binId].storageItems.push(storageItemData);
      }
    });

    return Object.values(itemsByBin);
  }

  public async getBinItemCombinations(keyword?: string) {
    return this._repository.findBinItemCombinations(keyword);
  }

  public async getAvailableItemTypes(type: PROCESS_ITEM_TYPE): Promise<string[]> {
    switch (type) {
      case PROCESS_ITEM_TYPE.ISSUE:
        return this._repository.findIssuableItemTypes();
      case PROCESS_ITEM_TYPE.RETURN:
        return this._repository.findReturnableItemTypes();
      case PROCESS_ITEM_TYPE.REPLENISH:
        return this._repository.findReplenishableItemTypes();
      default:
        throw AppHttpException.badRequest({ message: `Invalid process type provided: ${type}` });
    }
  }
}
