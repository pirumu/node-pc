export type Location = {
  binId: string;
  binName: string;
  cabinetId: string;
  cabinetName: string;
  clusterId: string;
  clusterName: string;
  siteId: string;
  siteName: string;
};

export type AnotherItem = {
  binId: string;
  name: string;
  itemId: string;
  loadcellId: string;
  loadcellHardwareId: number;
  currentQty: number;
};

export type PlannedItem = {
  itemId: string;
  loadcellId: string;
  loadcellHardwareId: number;
  name: string;
  requestQty: number;
  currentQty: number;
  location: Location;
  keepTrackItems: AnotherItem[];
  conditionId?: string;
};

export type ItemToTake = {
  itemId: string;
  name: string;
  currentQty: number;
  requestQty: number;
  loadcellId: string;
  loadcellHardwareId: number;
};

export type ItemToReturn = ItemToTake & { conditionId?: string };
export type ItemToReplenish = ItemToTake;

export type ExecutionStep = {
  stepId: string;
  binId: string;
  itemsToIssue: ItemToTake[];
  itemsToReturn: ItemToReturn[];
  itemsToReplenish: ItemToReplenish[];
  keepTrackItems: AnotherItem[];
  instructions: string[];
  location: Location;
};
