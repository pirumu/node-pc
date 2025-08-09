import { LeanDocument } from '@dals/mongo/base.repository';
import { Transaction } from '@dals/mongo/schema/transaction.schema';
import { TransactionEntity, UserInfo, CabinetInfo, BinInfo, SpareInfo, LocationInfo } from '@entity';
import { HydratedDocument } from 'mongoose';

export class TransactionMapper {
  public static toModel(entity: TransactionEntity): Transaction {
    const model = new Transaction();
    model.name = entity.name;
    model.type = entity.type;
    model.requestQty = entity.requestQty;
    model.clusterId = entity.clusterId;
    model.user = entity.user;
    model.locations = entity.locations;
    model.locationsTemp = entity.locationsTemp;
    model.status = entity.status;
    model.isSync = entity.isSync;
    model.retryCount = entity.retryCount;
    return model;
  }

  public static toEntity(model: Transaction | HydratedDocument<Transaction> | LeanDocument<Transaction> | null): TransactionEntity | null {
    if (!model) {
      return null;
    }
    return this._toEntity(model);
  }

  private static _toEntity(model: Transaction): TransactionEntity {
    return new TransactionEntity({
      id: model._id.toString(),
      name: model.name,
      type: model.type,
      error: model.error,
      requestQty: model.requestQty,
      clusterId: model.clusterId,
      user: this._mapUserInfo(model.user),
      locations: this._mapLocationInfoArray(model.locations),
      locationsTemp: this._mapLocationInfoArray(model.locationsTemp),
      status: model.status,
      isSync: model.isSync ?? false,
      retryCount: model.retryCount ?? 0,
      createdAt: model.createdAt?.toISOString(),
      updatedAt: model.updatedAt?.toISOString(),
    });
  }

  public static toEntities(models: Transaction[]): TransactionEntity[] {
    return models.map((model) => this._toEntity(model));
  }

  public static toModelArray(entities: TransactionEntity[]): Transaction[] {
    return entities.map((entity) => this.toModel(entity));
  }

  private static _mapUserInfo(userInfo: Transaction['user']): UserInfo {
    return {
      id: userInfo.id,
      cloudId: userInfo.cloudId,
      loginId: userInfo.loginId,
      role: userInfo.role,
    };
  }

  private static _mapCabinetInfo(cabinetInfo: Transaction['locations'][number]['cabinet']): CabinetInfo {
    return {
      id: cabinetInfo.id,
      name: cabinetInfo.name,
    };
  }

  private static _mapBinInfo(binInfo: Transaction['locations'][number]['bin']): BinInfo {
    return {
      id: binInfo.id,
      name: binInfo.name,
      row: binInfo.row,
      cuId: binInfo.cuId,
      lockId: binInfo.lockId,
    };
  }

  private static _mapSpareInfo(spareInfo: Transaction['locations'][number]['spares'][number]): SpareInfo {
    return {
      id: spareInfo.id,
      type: spareInfo.type,
      name: spareInfo.name,
      partNo: spareInfo.partNo,
      materialNo: spareInfo.materialNo,
      itemTypeId: spareInfo.itemTypeId,
      conditionName: spareInfo.name,
      quantity: spareInfo.quantity,
      previousQty: spareInfo.previousQty,
      currentQty: spareInfo.currentQty,
      changedQty: spareInfo.changedQty,
      workingOrders: spareInfo.workingOrders || [],
    };
  }

  private static _mapSpareInfoArray(spares: any[]): SpareInfo[] {
    return spares.map((spare) => this._mapSpareInfo(spare));
  }

  private static _mapLocationInfo(locationInfo: any): LocationInfo {
    return {
      cabinet: this._mapCabinetInfo(locationInfo.cabinet),
      bin: this._mapBinInfo(locationInfo.bin),
      spares: this._mapSpareInfoArray(locationInfo.spares),
    };
  }

  private static _mapLocationInfoArray(locations: any[]): LocationInfo[] {
    return locations.map((location) => this._mapLocationInfo(location));
  }
}
