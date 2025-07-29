import { LeanDocument } from '@dals/mongo/base.repository';
import { Bin } from '@dals/mongo/schema/bin.schema';
import { BinEntity } from '@entity';
import { HydratedDocument } from 'mongoose';

export class BinMapper {
  public static toModel(entity: BinEntity): Bin {
    const model = new Bin();
    model.cabinetId = entity.cabinetId;
    model.name = entity.name;
    model.cuId = entity.cuId;
    model.lockId = entity.lockId;
    model.countFailed = entity.countFailed;
    model.row = entity.row;
    model.min = entity.min;
    model.max = entity.max;
    model.critical = entity.critical;
    model.description = entity.description;
    model.processBy = entity.processBy;
    model.processTime = entity.processTime;
    model.isProcessing = entity.isProcessing;
    model.isFailed = entity.isFailed;
    model.isLocked = entity.isLocked;
    model.isRfid = entity.isRfid;
    model.isDamage = entity.isDamage;
    model.isDrawer = entity.isDrawer;
    model.drawerName = entity.drawerName;
    model.status = entity.status;
    model.isSync = entity.isSync;
    model.retryCount = entity.retryCount;
    model.isCalibrated = entity.isCalibrated;
    model.newMax = entity.newMax;
    return model;
  }

  public static toEntity(model: Bin | HydratedDocument<Bin> | LeanDocument<Bin> | null): BinEntity | null {
    if (!model) {
      return null;
    }
    return this._toEntity(model);
  }

  private static _toEntity(model: Bin): BinEntity {
    return new BinEntity({
      id: model._id.toString(),
      cabinetId: model.cabinetId,
      name: model.name,
      cuId: model.cuId,
      lockId: model.lockId,
      countFailed: model.countFailed,
      row: model.row,
      min: model.min,
      max: model.max,
      critical: model.critical,
      description: model.description,
      processBy: model.processBy,
      processTime: model.processTime,
      isProcessing: model.isProcessing,
      isFailed: model.isFailed,
      isLocked: model.isLocked,
      isRfid: model.isRfid,
      isDamage: model.isDamage,
      isDrawer: model.isDrawer,
      drawerName: model.drawerName,
      status: model.status,
      isSync: model.isSync,
      retryCount: model.retryCount,
      isCalibrated: model.isCalibrated,
      newMax: model.newMax,
      createdAt: model.createdAt?.toISOString(),
      updatedAt: model.updatedAt?.toISOString(),
    });
  }

  public static toEntities(models: Bin[]): BinEntity[] {
    return models.map((model) => this._toEntity(model));
  }

  public static toModelArray(entities: BinEntity[]): Bin[] {
    return entities.map((entity) => this.toModel(entity));
  }
}
