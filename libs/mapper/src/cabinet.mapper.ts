import { LeanDocument } from '@dals/mongo/base.repository';
import { Cabinet } from '@dals/mongo/schema/cabinet.schema';
import { CabinetEntity } from '@entity';
import { HydratedDocument } from 'mongoose';

export class CabinetMapper {
  public static toModel(entity: CabinetEntity): Cabinet {
    const model = new Cabinet();
    model.name = entity.name;
    model.code = entity.code;
    model.numberOfRows = entity.numberOfRows;
    model.totalBins = entity.totalBins;
    model.type = entity.type;
    return model;
  }

  public static toEntity(model: Cabinet | HydratedDocument<Cabinet> | LeanDocument<Cabinet> | null): CabinetEntity | null {
    if (!model) {
      return null;
    }
    return this._toEntity(model);
  }

  private static _toEntity(model: Cabinet): CabinetEntity {
    return new CabinetEntity({
      id: model._id.toString(),
      name: model.name,
      code: model.code,
      numberOfRows: model.numberOfRows,
      totalBins: model.totalBins,
      type: model.type,
      createdAt: model.createdAt?.toISOString(),
      updatedAt: model.updatedAt?.toISOString(),
    });
  }

  public static toEntities(models: Cabinet[]): CabinetEntity[] {
    return models.map((model) => this._toEntity(model));
  }

  public static toModelArray(entities: CabinetEntity[]): Cabinet[] {
    return entities.map((entity) => this.toModel(entity));
  }
}
