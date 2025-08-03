import { LeanDocument } from '@dals/mongo/base.repository';
import { Tablet } from '@dals/mongo/schema/tablet.schema';
import { TabletEntity } from '@entity';
import { HydratedDocument } from 'mongoose';

export class TabletMapper {
  public static toModel(entity: TabletEntity): Tablet {
    const model = new Tablet();
    model.deviceId = entity.deviceId;
    model.deviceKey = entity.deviceKey;
    model.setting = entity.setting;
    return model;
  }

  public static toEntity(model: Tablet | HydratedDocument<Tablet> | LeanDocument<Tablet> | null): TabletEntity | null {
    if (!model) {
      return null;
    }
    return this._toEntity(model);
  }

  private static _toEntity(model: Tablet): TabletEntity {
    return new TabletEntity({
      id: model._id.toString(),
      deviceId: model.deviceId,
      deviceKey: model.deviceKey,
      setting: model.setting as any,
      createdAt: model.createdAt?.toISOString(),
      updatedAt: model.updatedAt?.toISOString(),
    });
  }

  public static toEntities(models: Tablet[]): TabletEntity[] {
    return models.map((model) => this._toEntity(model));
  }

  public static toModelArray(entities: TabletEntity[]): Tablet[] {
    return entities.map((entity) => this.toModel(entity));
  }
}
