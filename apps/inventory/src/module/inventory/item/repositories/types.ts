import { LocationItem } from '@entity';
import { RequestIssueItemDto, WOItemDto } from '../dtos/request';

export type IssuedItem = {
  id: string;
  name: string;
  itemTypeId: string;
  type: string;
  partNo: string;
  materialNo: string;
  locations: LocationItem[];
  listWO: FormattedWO[];
};

export type FormattedWO = {
  woId: string;
  wo: string;
  vehicleId: string;
  platform: string;
  areaId: string;
  torq: number;
  area: string;
};

export type FormattedData = {
  cabinet: { id: string; name: string };
  bin: { id: string; name: string; row: number };
  requestItems: any[];
  storageItems: any[];
};

export type ItemsByBin = {
  [binId: string]: FormattedData & { requestedItemIds: Set<string> };
};

export type RequestIssueItem = RequestIssueItemDto;
export type RequestReturnItem = RequestIssueItem;
export type RequestWorkOrderItem = WOItemDto;
