import { LeanDocument } from '@dals/mongo/base.repository';
import { ReturnItem } from '@dals/mongo/schema/return-item.schema';
import { ReturnItemEntity, WorkOrderItem, LocationItem } from '@entity';
import { HydratedDocument } from 'mongoose';

export class ReturnItemMapper {
  public static toModel(entity: ReturnItemEntity): ReturnItem {
    const model = new ReturnItem();
    model.itemId = entity.itemId;
    model.userId = entity.userId;
    model.binId = entity.binId;
    model.quantity = entity.quantity;
    model.listWo = entity.listWo;
    model.locations = entity.locations;
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
      itemId: model.itemId,
      userId: model.userId,
      binId: model.binId,
      quantity: model.quantity,
      listWo: this._mapWorkOrders(model.listWo),
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

  private static _mapWorkOrders(listWo?: Array<any>): WorkOrderItem[] {
    if (!listWo || !listWo.length) {
      return [];
    }

    return listWo.map((wo) => ({
      woId: wo.woId,
      wo: wo.wo,
      vehicleId: wo.vehicleId,
      platform: wo.platform,
      areaId: wo.areaId,
      torq: wo.torq,
      area: wo.area,
    }));
  }

  private static _mapLocations(locations?: Array<any>): LocationItem[] {
    if (!locations || !locations.length) {
      return [];
    }

    return locations.map((location) => ({
      quantity: location.quantity,
      bin: {
        id: location.bin.id?.toString(),
      },
      requestQty: location.requestQty,
      preQty: location.preQty,
    }));
  }
}
