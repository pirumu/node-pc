import { LeanDocument } from '@dals/mongo/base.repository';
import { Location, ReturnItem } from '@dals/mongo/schema/return-item.schema';
import { ReturnItemEntity, LocationItem, WorkingOrderItem } from '@entity';
import { HydratedDocument, Types } from 'mongoose';

export class ReturnItemMapper {
  public static toModel(entity: ReturnItemEntity): ReturnItem {
    const model = new ReturnItem();
    model.itemId = new Types.ObjectId(entity.itemId);
    model.userId = new Types.ObjectId(entity.userId);
    model.binId = new Types.ObjectId(entity.binId);
    model.quantity = entity.quantity;
    model.workingOrders = entity.workingOrders;
    model.locations = entity.locations.map((l) => {
      const model = new Location();
      model.bin = l.bin;
      model.quantity = l.quantity;
      model.preQty = l.preQty;
      model.requestQty = l.requestQty;
      return model;
    });
    return model;
  }

  public static toEntity(model: ReturnItem | HydratedDocument<ReturnItem> | LeanDocument<ReturnItem> | null): ReturnItemEntity | null {
    if (!model) {
      return null;
    }
    return this._toEntity(model);
  }

  private static _toEntity(model: ReturnItem): ReturnItemEntity {
    return new ReturnItemEntity({
      id: model._id.toString(),
      itemId: model.itemId.toString(),
      userId: model.userId.toString(),
      binId: model.binId.toString(),
      quantity: model.quantity,
      workingOrders: this._mapWorkingOrders(model.workingOrders),
      locations: this._mapLocations(model.locations),
      createdAt: model.createdAt?.toISOString(),
      updatedAt: model.updatedAt?.toISOString(),
    });
  }

  public static toEntities(models: ReturnItem[]): ReturnItemEntity[] {
    return models.map((model) => this._toEntity(model));
  }

  public static toModelArray(entities: ReturnItemEntity[]): ReturnItem[] {
    return entities.map((entity) => this.toModel(entity));
  }

  private static _mapWorkingOrders(workingOrders?: Array<any>): WorkingOrderItem[] {
    if (!workingOrders || !workingOrders.length) {
      return [];
    }

    return workingOrders.map((wo) => ({
      woId: wo.woId,
      wo: wo.wo,
      vehicleId: wo.vehicleId,
      platform: wo.platform,
      areaId: wo.areaId,
      torq: wo.torq,
      area: wo.area,
    }));
  }

  private static _mapLocations(locations?: Location[]): LocationItem[] {
    if (!locations || !locations.length) {
      return [];
    }
    return locations.map(
      (location) =>
        ({
          cabinet: location.cabinet,
          bin: {
            id: location.bin.id?.toString() || location.bin.id,
            name: location.bin.name,
            row: location.bin.row,
          },
          requestQty: location.requestQty,
          preQty: location.preQty,
          quantity: location.quantity,
        }) as any,
    );
  }
}
