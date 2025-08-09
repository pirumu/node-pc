import { LeanDocument } from '@dals/mongo/base.repository';
import { BinItem } from '@dals/mongo/schema/bin-item.schema';
import { BinItemEntity } from '@entity';
import { HydratedDocument, Types } from 'mongoose';

export class BinItemMapper {
  public static toModel(entity: BinItemEntity): BinItem {
    const model = new BinItem();
    model.binId = new Types.ObjectId(entity.binId);
    model.itemId = new Types.ObjectId(entity.itemId);
    model.order = entity.order;
    model.min = entity.min;
    model.max = entity.max;
    model.critical = entity.critical;
    model.hasChargeTime = Boolean(entity.hasChargeTime);
    model.hasCalibrationDue = entity.hasCalibrationDue;
    model.hasExpiryDate = Boolean(entity.hasExpiryDate);
    model.hasLoadHydrostaticTestDue = entity.hasLoadHydrostaticTestDue;
    model.batchNo = entity.batchNo;
    model.serialNo = entity.serialNo;
    model.chargeTime = entity.chargeTime;
    model.calibrationDue = entity.calibrationDue ? new Date(entity.calibrationDue) : undefined;
    model.expiryDate = entity.expiryDate ? new Date(entity.expiryDate) : undefined;
    model.loadHydrostaticTestDue = entity.loadHydrostaticTestDue ? new Date(entity.loadHydrostaticTestDue) : undefined;
    model.description = entity.description;
    return model;
  }

  public static toEntity(model: BinItem | HydratedDocument<BinItem> | LeanDocument<BinItem> | null): BinItemEntity | null {
    if (!model) {
      return null;
    }
    return this._toEntity(model);
  }

  private static _toEntity(model: BinItem): BinItemEntity {
    return new BinItemEntity({
      id: model._id.toString(),
      binId: model.binId.toString(),
      itemId: model.itemId.toString(),
      order: model.order,
      min: model.min,
      max: model.max,
      critical: model.critical,
      hasChargeTime: Number(model.hasChargeTime),
      hasCalibrationDue: model.hasCalibrationDue,
      hasExpiryDate: Number(model.hasExpiryDate),
      hasLoadHydrostaticTestDue: model.hasLoadHydrostaticTestDue,
      batchNo: model.batchNo,
      serialNo: model.serialNo,
      chargeTime: model.chargeTime,
      calibrationDue: model.calibrationDue?.toISOString(),
      expiryDate: model.expiryDate?.toISOString(),
      loadHydrostaticTestDue: model.loadHydrostaticTestDue?.toISOString(),
      description: model.description,
      createdAt: model.createdAt?.toISOString(),
      updatedAt: model.updatedAt?.toISOString(),
    });
  }

  public static toEntities(models: BinItem[]): BinItemEntity[] {
    return models.map((model) => this._toEntity(model));
  }

  public static toModelArray(entities: BinItemEntity[]): BinItem[] {
    return entities.map((entity) => this.toModel(entity));
  }
}
