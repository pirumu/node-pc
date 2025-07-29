import { LeanDocument } from '@dals/mongo/base.repository';
import { Condition } from '@dals/mongo/schema/condition.schema';
import { ConditionEntity } from '@entity';
import { HydratedDocument } from 'mongoose';

export class ConditionMapper {
  public static toModel(entity: ConditionEntity): Condition {
    const model = new Condition();
    model.condition = entity.condition;
    model.description = entity.description;
    return model;
  }

  public static toEntity(model: Condition | HydratedDocument<Condition> | LeanDocument<Condition> | null): ConditionEntity | null {
    if (!model) {
      return null;
    }
    return this._toEntity(model);
  }

  private static _toEntity(model: Condition): ConditionEntity {
    return new ConditionEntity({
      id: model._id.toString(),
      condition: model.condition,
      description: model.description,
      createdAt: model.createdAt?.toISOString(),
      updatedAt: model.updatedAt?.toISOString(),
    });
  }

  public static toEntities(models: Condition[]): ConditionEntity[] {
    return models.map((model) => this._toEntity(model));
  }

  public static toModelArray(entities: ConditionEntity[]): Condition[] {
    return entities.map((entity) => this.toModel(entity));
  }
}
