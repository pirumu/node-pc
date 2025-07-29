import { LeanDocument } from '@dals/mongo/base.repository';
import { Port } from '@dals/mongo/schema/port.schema';
import { PortEntity } from '@entity';
import { HydratedDocument } from 'mongoose';

export class PortMapper {
  public static toModel(entity: PortEntity): Port {
    const model = new Port();
    model.name = entity.name;
    model.path = entity.path;
    model.heartbeat = entity.heartbeat;
    model.status = entity.status;
    return model;
  }

  public static toEntity(model: Port | HydratedDocument<Port> | LeanDocument<Port> | null): PortEntity | null {
    if (!model) {
      return null;
    }
    return this._toEntity(model);
  }

  private static _toEntity(model: Port): PortEntity {
    return new PortEntity({
      id: model._id.toString(),
      name: model.name,
      path: model.path,
      heartbeat: model.heartbeat,
      status: model.status,
      createdAt: model.createdAt?.toISOString(),
      updatedAt: model.updatedAt?.toISOString(),
    });
  }

  public static toEntities(models: Port[]): PortEntity[] {
    return models.map((model) => this._toEntity(model));
  }

  public static toModelArray(entities: PortEntity[]): Port[] {
    return entities.map((entity) => this.toModel(entity));
  }
}
