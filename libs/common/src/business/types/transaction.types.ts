export type Location = {
  binId: string;
};

export type AnotherItem = {
  binId: string;
  name: string;
  itemId: string;
  loadcellId: string;
  currentQty: number;
};

export type PlannedItem = {
  itemId: string;
  loadcellId: string;
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
};

export type RequestPayload = {
  steps: ExecutionStep[];
};
