export type LoadcellItemDto = {
  itemId: string;
  qty: number;
  critical: number;
  min: number;
  max: number;
  inspection: string;
  qtyOriginal: number;
};

export type LoadcellDto = {
  id: string;
  label: string;
  code: string;
  siteId: string;
  clusterId: string;
  cabinetId: string;
  binId: string;
  createdBy: string;
  updatedBy: string;
  item: LoadcellItemDto;
  createdAt: string;
  updatedAt: string;
};
