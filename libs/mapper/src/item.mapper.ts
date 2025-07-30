import { LeanDocument } from '@dals/mongo/base.repository';
import { Item } from '@dals/mongo/schema/item.schema';
import { ItemEntity } from '@entity';
import { HydratedDocument } from 'mongoose';

export class ItemMapper {
  public static toModel(entity: ItemEntity): Item {
    const model = new Item();
    model.name = entity.name;
    model.partNo = entity.partNo;
    model.materialNo = entity.materialNo;
    model.itemTypeId = entity.itemTypeId;
    model.type = entity.type;
    model.image = entity.image;
    model.description = entity.description;
    return model;
  }

  public static toEntity(model: Item | HydratedDocument<Item> | LeanDocument<Item> | null): ItemEntity | null {
    if (!model) {
      return null;
    }
    return this._toEntity(model);
  }

  private static _toEntity(model: Item): ItemEntity {
    return new ItemEntity({
      id: model._id.toString(),
      name: model.name,
      partNo: model.partNo,
      materialNo: model.materialNo,
      itemTypeId: model.itemTypeId,
      type: model.type,
      image: model.image,
      description: model.description,
      createdAt: model.createdAt?.toISOString(),
      updatedAt: model.updatedAt?.toISOString(),
    });
  }

  public static toEntities(models: Item[]): ItemEntity[] {
    return models.map((model) => this._toEntity(model));
  }

  public static toModelArray(entities: ItemEntity[]): Item[] {
    return entities.map((entity) => this.toModel(entity));
  }
}
