import { LeanDocument } from '@dals/mongo/base.repository';
import { Device, DeviceDescription } from '@dals/mongo/schema/device.schema';
import { DeviceEntity, DeviceDescriptionEntity } from '@entity';
import { HydratedDocument, Types } from 'mongoose';

export class DeviceMapper {
  public static toModel(entity: DeviceEntity): Device {
    const model = new Device();

    model.deviceNumId = entity.deviceNumId;
    model.portId = new Types.ObjectId(entity.portId);
    model.binId = entity.binId ? new Types.ObjectId(entity.binId) : undefined;
    model.itemId = entity.itemId ? new Types.ObjectId(entity.itemId) : undefined;
    model.quantity = entity.quantity;
    model.calcQuantity = entity.calcQuantity;
    model.damageQuantity = entity.damageQuantity;
    model.weight = entity.weight;
    model.zeroWeight = entity.zeroWeight;
    model.unitWeight = entity.unitWeight;
    model.calcWeight = entity.calcWeight;
    model.quantityMinThreshold = entity.quantityMinThreshold;
    model.quantityCritThreshold = entity.quantityCritThreshold;
    model.macAddress = entity.macAddress;
    model.chipId = entity.chipId;
    model.heartbeat = entity.heartbeat;
    model.setupTimestamp = entity.setupTimestamp;
    model.zeroTimestamp = entity.zeroTimestamp;
    model.weightHistory = entity.weightHistory || [];
    model.count = entity.count;
    model.changeQty = entity.changeQty;
    model.status = entity.status;
    model.isSync = entity.isSync;
    model.retryCount = entity.retryCount;
    model.isUpdateWeight = entity.isUpdateWeight;
    model.label = entity.label;

    if (entity.description) {
      model.description = this._toDescriptionModel(entity.description);
    }

    return model;
  }

  private static _toDescriptionModel(entity: DeviceDescriptionEntity): DeviceDescription {
    const description = new DeviceDescription();
    description.name = entity.name;
    description.partNumber = entity.partNumber;
    description.materialNo = entity.materialNo;
    description.supplierEmail = entity.supplierEmail;
    description.matlGrp = entity.matlGrp;
    description.criCode = entity.criCode;
    description.jom = entity.jom;
    description.itemAcct = entity.itemAcct;
    description.field1 = entity.field1;
    description.expiryBag = entity.expiryBag;
    description.quantityBag = entity.quantityBag;
    description.bagNoBatch = entity.bagNoBatch;
    description.expiryBag2 = entity.expiryBag2;
    description.quantityBag2 = entity.quantityBag2;
    description.bagNoBatch2 = entity.bagNoBatch2;
    description.expiryBag3 = entity.expiryBag3;
    description.quantityBag3 = entity.quantityBag3;
    description.bagNoBatch3 = entity.bagNoBatch3;
    return description;
  }

  public static toEntity(model: Device | HydratedDocument<Device> | LeanDocument<Device> | null): DeviceEntity | null {
    if (!model) {
      return null;
    }
    return this._toEntity(model);
  }

  private static _toEntity(model: Device): DeviceEntity {
    return new DeviceEntity({
      id: model._id.toString(),
      deviceNumId: model.deviceNumId,
      portId: model.portId.toString(),
      binId: model.binId?.toString(),
      itemId: model.itemId?.toString(),
      quantity: model.quantity || 0,
      calcQuantity: model.calcQuantity || 0,
      damageQuantity: model.damageQuantity || 0,
      weight: model.weight || 0,
      zeroWeight: model.zeroWeight || 0,
      unitWeight: model.unitWeight || 0,
      calcWeight: model.calcWeight || 0,
      quantityMinThreshold: model.quantityMinThreshold || 0,
      quantityCritThreshold: model.quantityCritThreshold || 0,
      macAddress: model.macAddress || '',
      chipId: model.chipId || '',
      heartbeat: model.heartbeat || 0,
      setupTimestamp: model.setupTimestamp,
      zeroTimestamp: model.zeroTimestamp,
      weightHistory: model.weightHistory,
      count: model.count || 0,
      changeQty: model.changeQty || 0,
      status: model.status,
      isSync: !!model.isSync,
      retryCount: model.retryCount || 0,
      isUpdateWeight: !!model.isUpdateWeight,
      label: model.label,
      description: model.description ? this._toDescriptionEntity(model.description) : {},
      createdAt: model.createdAt?.toISOString(),
      updatedAt: model.updatedAt?.toISOString(),
    });
  }

  private static _toDescriptionEntity(model: DeviceDescription): DeviceDescriptionEntity {
    return new DeviceDescriptionEntity({
      name: model.name,
      partNumber: model.partNumber,
      materialNo: model.materialNo,
      supplierEmail: model.supplierEmail,
      matlGrp: model.matlGrp,
      criCode: model.criCode,
      jom: model.jom,
      itemAcct: model.itemAcct,
      field1: model.field1,
      expiryBag: model.expiryBag,
      quantityBag: model.quantityBag,
      bagNoBatch: model.bagNoBatch,
      expiryBag2: model.expiryBag2,
      quantityBag2: model.quantityBag2,
      bagNoBatch2: model.bagNoBatch2,
      expiryBag3: model.expiryBag3,
      quantityBag3: model.quantityBag3,
      bagNoBatch3: model.bagNoBatch3,
    });
  }

  public static toEntities(models: Device[]): DeviceEntity[] {
    return models.map((model) => this._toEntity(model));
  }

  public static toModelArray(entities: DeviceEntity[]): Device[] {
    return entities.map((entity) => this.toModel(entity));
  }
}
