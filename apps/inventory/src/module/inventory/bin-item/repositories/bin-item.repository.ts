import { BinItemWithIdAndName } from '@entity';

export const BIN_ITEM_REPOSITORY_TOKEN = Symbol('IBinItemRepository');

export interface IBinItemRepository {
  findAll(filter: { keyword?: string }): Promise<BinItemWithIdAndName[]>;
}
