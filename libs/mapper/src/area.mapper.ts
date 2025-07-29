import { LeanDocument } from '@dals/mongo/base.repository';
import { Area } from '@dals/mongo/schema/area.schema';
import { AreaEntity } from '@entity';
import { HydratedDocument } from 'mongoose';

export class AreaMapper {
  public static toModel(entity: AreaEntity): Area {
    const model = new Area();
    model.name = entity.name;
    model.torque = entity.torque;
    return model;
  }

  public static toEntity(model: Area | HydratedDocument<Area> | LeanDocument<Area> | null): AreaEntity | null {
    if (!model) {
      return null;
    }
    return this._toEntity(model);
  }

  private static _toEntity(model: Area): AreaEntity {
    return new AreaEntity({
      id: model._id.toString(),
      name: model.name,
      torque: model.torque,
      createdAt: model.createdAt?.toISOString(),
      updatedAt: model.updatedAt?.toISOString(),
    });
  }

  public static toEntities(models: Area[]): AreaEntity[] {
    return models.map((model) => this._toEntity(model));
  }

  public static toModelArray(entities: AreaEntity[]): Area[] {
    return entities.map((entity) => this.toModel(entity));
  }
}
