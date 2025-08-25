export type FindIssuableItemsParams = {
  page: number;
  limit: number;
  keyword?: string;
  itemTypeId?: string;
  expiryDate: number;
};

export type IssuableItemRecord = {
  id: string;
  name: string;
  partNo: string;
  materialNo: string;
  itemTypeId: string;
  type: string;
  image?: string;
  description?: string;
  totalQuantity: number;
  totalCalcQuantity?: number;
  binId: string;
  binName: string;
  dueDate: Date | null;
  canIssue: boolean;
};

export type PaginatedIssuableItemsOutput = {
  rows: IssuableItemRecord[];
  total: number;
};

export type ItemsForIssueInput = { expiryDate: number; itemIds: string[] };

// return
export type FindReturnableItemsParams = {
  userId: string;
  page: number;
  limit: number;
  keyword?: string;
  itemTypeId?: string;
};

export type ReturnableItemRecord = {
  id: string;
  name: string;
  partNo: string;
  materialNo: string;
  itemTypeId: string;
  type: string;
  image?: string;
  description?: string;
  issuedQuantity: number;
  locations: string[];
  itemInfo: Array<{
    issuedQuantity: number;
    binId: string;
    batchNumber: string;
    serialNumber: string;
    dueDate?: Date;
  }>;
  workingOrders?: any[];
};

export type PaginatedReturnableItemsOutput = {
  rows: ReturnableItemRecord[];
  total: number;
};

export type ItemsForReturnParams = { userId: string; pairs: Array<{ itemId: string; binId: string }> };

// replenish

export type FindReplenishableItemsParams = {
  page: number;
  limit: number;
  keyword?: string;
  itemTypeId?: string;
};

export type ReplenishableItemRecord = {
  id: string;
  name: string;
  partNo: string;
  materialNo: string;
  itemTypeId: string;
  type: string;
  image?: string;
  description?: string;
  totalQuantity: number;
  totalCalcQuantity: number;
  binId: string;
  canReplenish: boolean;
};

export type PaginatedReplenishableItemsOutput = {
  rows: ReplenishableItemRecord[];
  total: number;
};

export type ItemsForReplenishParams = { pairs: Array<{ itemId: string; binId: string }> };

// working order

export type BinItemCombinationOutput = {
  id: string;
  name: string;
};
