import { BinItemWithIdAndName } from '@entity';
import { Inject, Injectable } from '@nestjs/common';

import { BIN_ITEM_REPOSITORY_TOKEN, IBinItemRepository } from './repositories';

@Injectable()
export class BinItemService {
  constructor(@Inject(BIN_ITEM_REPOSITORY_TOKEN) private readonly _repository: IBinItemRepository) {}

  public async getListBinItem(keyword?: string): Promise<BinItemWithIdAndName[]> {
    return this._repository.findAll({ keyword });
  }
}
