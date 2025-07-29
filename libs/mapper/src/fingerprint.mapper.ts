import { LeanDocument } from '@dals/mongo/base.repository';
import { Fingerprint } from '@dals/mongo/schema/fingerprint.schema';
import { FingerprintEntity } from '@entity';
import { HydratedDocument } from 'mongoose';

export class FingerprintMapper {
  public static toModel(entity: FingerprintEntity): Fingerprint {
    const model = new Fingerprint();
    model.userId = entity.userId;
    model.label = entity.label;
    model.feature = entity.feature;
    model.objectId = entity.objectId;
    model.isSync = entity.isSync;
    return model;
  }

  public static toEntity(model: Fingerprint | HydratedDocument<Fingerprint> | LeanDocument<Fingerprint> | null): FingerprintEntity | null {
    if (!model) {
      return null;
    }
    return this._toEntity(model);
  }

  private static _toEntity(model: Fingerprint): FingerprintEntity {
    return new FingerprintEntity({
      id: model._id.toString(),
      userId: model.userId,
      label: model.label,
      feature: model.feature,
      objectId: model.objectId,
      isSync: model.isSync,
      createdAt: model.createdAt?.toISOString(),
      updatedAt: model.updatedAt?.toISOString(),
    });
  }

  public static toEntities(models: Fingerprint[]): FingerprintEntity[] {
    return models.map((model) => this._toEntity(model));
  }

  public static toModelArray(entities: FingerprintEntity[]): Fingerprint[] {
    return entities.map((entity) => this.toModel(entity));
  }
}
