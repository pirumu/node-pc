import { ItemTypeEntity } from '@dals/mongo/entities/item-type.entity';
import { EntityManager } from '@mikro-orm/mongodb';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ItemService {
  constructor(private readonly _em: EntityManager) {}

  public async getAvailableItemTypes(): Promise<ItemTypeEntity[]> {
    return this._em.find(ItemTypeEntity, {});
  }
}
