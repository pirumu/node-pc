import { LeanDocument } from '@dals/mongo/base.repository';
import { ItemType } from '@dals/mongo/schema/item-type.schema';
import { ItemTypeEntity } from '@entity/item-type.entity';
import { HydratedDocument } from 'mongoose';

export class ItemTypeMapper {
  public static toModel(entity: ItemTypeEntity): ItemType {
    const model = new ItemType();
    model.type = entity.type;
    model.description = entity.type;
    model.isIssue = entity.isIssue;
    model.isReturn = entity.isReturn;
    model.isReplenish = entity.isReplenish;
    return model;
  }

  public static toEntity(model: ItemType | HydratedDocument<ItemType> | LeanDocument<ItemType> | null): ItemTypeEntity | null {
    if (!model) {
      return null;
    }
    return this._toEntity(model);
  }

  private static _toEntity(model: ItemType): ItemTypeEntity {
    return new ItemTypeEntity({
      id: model._id.toString(),
      type: model.type,
      description: model.type,
      isIssue: model.isIssue,
      isReturn: model.isReturn,
      isReplenish: model.isReplenish,
      createdAt: model.createdAt?.toISOString(),
      updatedAt: model.updatedAt?.toISOString(),
    });
  }

  public static toEntities(models: ItemType[]): ItemTypeEntity[] {
    return models.map((model) => this._toEntity(model));
  }

  public static toModelArray(entities: ItemTypeEntity[]): ItemType[] {
    return entities.map((entity) => this.toModel(entity));
  }
}
