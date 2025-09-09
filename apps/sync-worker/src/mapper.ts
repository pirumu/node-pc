import { CONDITION_TYPE } from '@common/constants';
import {
  AreaEntity,
  BinEntity,
  BinType,
  CabinetEntity,
  CabinetType,
  ClusterEntity,
  ConditionEntity,
  ItemEntity,
  ItemTypeCategoryType,
  ItemTypeEntity,
  LoadcellEntity,
  UserEntity,
  WorkingOrderEntity,
} from '@dals/mongo/entities';
import { EntityData, ObjectId } from '@mikro-orm/mongodb';
import {
  AreaDto,
  BinDto,
  CabinetDto,
  ClusterDto,
  ConditionDto,
  ItemDto,
  ItemTypeDto,
  LoadcellDto,
  UserDto,
  WorkingOrderDto,
} from '@services/dto';

// Site Mapper
// Role Mapper
// Department Mapper
// Tablet Mapper

export class UserMapper {
  public static fromDto(user: UserDto): EntityData<UserEntity> {
    return {
      _id: new ObjectId(user.id),
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      address: user.address,
      avatar: user.avatar || '',
      email: user.email,
      status: user.status,
      role: user.roleKey,
      sites: (user.siteIds || []).map((site) => new ObjectId(typeof site === 'string' ? site : site.$oid)),
      permissions: user.permissions || [],
      updatedAt: new Date(user.updatedAt),
      createdAt: new Date(user.createdAt),
      createdBy: new ObjectId(user.createdBy),
      updatedBy: new ObjectId(user.updatedBy),
    };
  }
}

export class ClusterMapper {
  public static fromDto(cluster: ClusterDto): EntityData<ClusterEntity> {
    return {
      _id: new ObjectId(cluster.id),
      site: new ObjectId(cluster.siteId),
      name: cluster.name,
      code: cluster.code,
      isRFID: cluster.isRFID,
      isVirtual: cluster.isVirtual,
      createdAt: new Date(cluster.createdAt),
      updatedAt: new Date(cluster.updatedAt),
      createdBy: new ObjectId(cluster.createdBy),
      updatedBy: new ObjectId(cluster.updatedBy),
    };
  }
}

export class CabinetMapper {
  public static fromDto(cabinet: CabinetDto): EntityData<CabinetEntity> {
    return {
      _id: new ObjectId(cabinet.id),
      site: new ObjectId(cabinet.siteId),
      cluster: new ObjectId(cabinet.clusterId),
      name: cabinet.name,
      rowNumber: cabinet.rowNumber,
      binNumber: cabinet.binNumber,
      type: cabinet.type as CabinetType,
      binType: cabinet.binType,
      loadcellPerBin: cabinet.loadcellPerBin,
      createdAt: new Date(cabinet.createdAt),
      updatedAt: new Date(cabinet.updatedAt),
      createdBy: new ObjectId(cabinet.createdBy),
      updatedBy: new ObjectId(cabinet.updatedBy),
    };
  }
}

export class ItemTypeMapper {
  public static fromDto(itemType: ItemTypeDto): EntityData<ItemTypeEntity> {
    return {
      _id: new ObjectId(itemType.id),
      site: new ObjectId(itemType.siteId),
      name: itemType.name,
      description: itemType.description,
      category: itemType.category as ItemTypeCategoryType,
      createdAt: new Date(itemType.createdAt),
      updatedAt: new Date(itemType.updatedAt),
      createdBy: new ObjectId(itemType.createdBy),
      updatedBy: new ObjectId(itemType.updatedBy),
    };
  }
}

export class ItemMapper {
  public static fromDto(item: ItemDto): EntityData<ItemEntity> {
    return {
      _id: new ObjectId(item.id),
      partNo: item.partNo,
      materialNo: item.materialNo,
      name: item.name,
      supplierEmail: item.supplierEmail,
      itemAccount: item.itemAccount,
      criCode: item.criCode,
      uom: item.uom,
      materialGroup: item.materialGroup,
      hasBatchNumber: item.hasBatchNumber,
      hasSerialNumber: item.hasSerialNumber,
      hasMinChargeTime: item.hasMinChargeTime,
      hasInspection: item.hasInspection,
      hasExpiryDate: item.hasExpiryDate,
      hasHydrostaticTest: item.hasHydrostaticTest,
      hasRFID: item.hasRFID,
      hasBarcode: item.hasBarcode,
      description: item.description,
      itemImage: item.itemImage,
      unitCost: item.unitCost,
      retailCost: item.retailCost,
      site: new ObjectId(item.siteId),
      itemType: new ObjectId(item.itemTypeId),
      createdAt: new Date(item.createdAt),
      updatedAt: new Date(item.updatedAt),
      createdBy: new ObjectId(item.createdBy),
      updatedBy: new ObjectId(item.updatedBy),
    };
  }
}

export class AreaMapper {
  public static fromDto(area: AreaDto): EntityData<AreaEntity> {
    return {
      _id: new ObjectId(area.id),
      site: new ObjectId(area.siteId),
      name: area.name,
      torque: parseFloat(area.torque) || 0,
      createdAt: new Date(area.createdAt),
      updatedAt: new Date(area.updatedAt),
      createdBy: new ObjectId(area.createdBy),
      updatedBy: new ObjectId(area.updatedBy),
    };
  }
}

export class ConditionMapper {
  public static fromDto(condition: ConditionDto): EntityData<ConditionEntity> {
    return {
      _id: new ObjectId(condition.id),
      site: new ObjectId(condition.siteId),
      name: condition.name as CONDITION_TYPE,
      isSystemType: condition.isSystemType,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: new ObjectId(condition.createdBy),
      updatedBy: new ObjectId(condition.updatedBy),
    };
  }
}

export class LoadcellMapper {
  public static fromDto(loadcell: LoadcellDto): EntityData<LoadcellEntity> {
    return {
      _id: new ObjectId(loadcell.id),
      site: new ObjectId(loadcell.siteId),
      cluster: new ObjectId(loadcell.clusterId),
      cabinet: new ObjectId(loadcell.cabinetId),
      bin: new ObjectId(loadcell.binId),
      code: loadcell.code,
      label: loadcell.label,
      item: new ObjectId(loadcell.item.itemId),
      metadata: {
        itemId: new ObjectId(loadcell.item.itemId),
        qty: loadcell.item.qty,
        critical: loadcell.item.critical,
        min: loadcell.item.min,
        max: loadcell.item.max,
        qtyOriginal: loadcell.item.qtyOriginal,
        inspection: loadcell.item.inspection ? new Date(loadcell.item.inspection) : null,
      },
      createdAt: loadcell.createdAt ? new Date(loadcell.createdAt) : new Date(),
      updatedAt: loadcell.updatedAt ? new Date(loadcell.updatedAt) : new Date(),
      createdBy: new ObjectId(loadcell.createdBy),
      updatedBy: new ObjectId(loadcell.updatedBy),
    };
  }
}

export class BinMapper {
  public static fromDto(bin: BinDto): EntityData<BinEntity> {
    return {
      _id: new ObjectId(bin.id),
      site: new ObjectId(bin.siteId),
      cluster: new ObjectId(bin.clusterId),
      cabinet: new ObjectId(bin.cabinetId),
      loadcells: bin.loadcellIds.map((loadcellId) => new ObjectId(loadcellId)),
      cuLockId: bin.cuLockId,
      lockId: bin.lockId,
      x: bin.x,
      y: bin.y,
      width: bin.width,
      height: bin.height,
      index: bin.index,
      minQty: bin.min,
      maxQty: bin.max,
      criticalQty: bin.critical,
      type: bin.type as BinType,
      items: bin.items.map((item) => ({
        itemId: new ObjectId(item.itemId),
        qty: item.qty,
        critical: item.critical,
        min: item.min,
        max: item.max,
        description: item.description || '',
        barcode: item.barcode,
        rfid: item.rfid,
        serialNumber: item.serialNumber,
        batchNumber: item.batchNumber,
        chargeTime: item.chargeTime ? new Date(item.chargeTime) : null,
        inspection: item.inspection ? new Date(item.inspection) : null,
        hydrostaticTest: item.hydrostaticTest ? new Date(item.hydrostaticTest) : null,
        expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
        position: item.position,
      })),
      antennaNo: bin.antennaNo,
      gatewayIp: bin.gatewayIp,
      createdAt: bin.createdAt ? new Date(bin.createdAt) : new Date(),
      updatedAt: bin.updatedAt ? new Date(bin.updatedAt) : new Date(),
      createdBy: new ObjectId(bin.createdBy),
      updatedBy: new ObjectId(bin.updatedBy),
    };
  }
}

export class WorkingOrderMapper {
  public static fromDto(workingOrder: WorkingOrderDto): EntityData<WorkingOrderEntity> {
    return {
      _id: new ObjectId(workingOrder.id),
      code: workingOrder.code,
      description: workingOrder.description,
      site: new ObjectId(workingOrder.siteId),
      createdAt: workingOrder.createdAt,
      updatedAt: workingOrder.updatedAt,
      createdBy: new ObjectId(workingOrder.createdBy),
      updatedBy: new ObjectId(workingOrder.updatedBy),
    };
  }
}
