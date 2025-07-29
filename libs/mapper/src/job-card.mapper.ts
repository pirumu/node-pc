import { LeanDocument } from '@dals/mongo/base.repository';
import { JobCard } from '@dals/mongo/schema/job-card.schema';
import { JobCardEntity } from '@entity';
import { HydratedDocument } from 'mongoose';

export class JobCardMapper {
  public static toModel(entity: JobCardEntity): JobCard {
    const model = new JobCard();
    model.wo = entity.wo;
    model.platform = entity.platform;
    model.vehicleId = entity.vehicleId;
    model.status = entity.status;
    model.cardNumber = entity.cardNumber;
    model.vehicleNum = entity.vehicleNum;
    model.vehicleType = entity.vehicleType;
    model.isSync = entity.isSync;
    model.retryCount = entity.retryCount;
    return model;
  }

  public static toEntity(model: JobCard | HydratedDocument<JobCard> | LeanDocument<JobCard> | null): JobCardEntity | null {
    if (!model) {
      return null;
    }
    return this._toEntity(model);
  }

  private static _toEntity(model: JobCard): JobCardEntity {
    return new JobCardEntity({
      id: model._id.toString(),
      wo: model.wo,
      platform: model.platform,
      vehicleId: model.vehicleId,
      status: model.status,
      cardNumber: model.cardNumber,
      vehicleNum: model.vehicleNum,
      vehicleType: model.vehicleType,
      isSync: model.isSync,
      retryCount: model.retryCount,
      createdAt: model.createdAt?.toISOString(),
      updatedAt: model.updatedAt?.toISOString(),
    });
  }

  public static toEntities(models: JobCard[]): JobCardEntity[] {
    return models.map((model) => this._toEntity(model));
  }

  public static toModelArray(entities: JobCardEntity[]): JobCard[] {
    return entities.map((entity) => this.toModel(entity));
  }
}
