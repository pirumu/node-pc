// import { BinMRepository, DeviceMRepository, ItemTypeMRepository, TransactionMRepository } from '@dals/mongo/repositories';
// import { Device } from '@dals/mongo/schema/device.schema';
// import { TransactionEntity, BinEntity, DeviceEntity } from '@entity';
// import { Properties } from '@framework/types';
// import { BinMapper, DeviceMapper, TransactionMapper } from '@mapper';
// import { Injectable, Logger } from '@nestjs/common';
// import { Types } from 'mongoose';
//
// @Injectable()
// export class ProcessItemImplRepository {
//   private readonly _logger = new Logger(ProcessItemImplRepository.name);
//
//   constructor(
//     private readonly _binMRepository: BinMRepository,
//     private readonly _deviceRepository: DeviceMRepository,
//     private readonly _itemTypeRepository: ItemTypeMRepository,
//     private readonly _transactionMRepository: TransactionMRepository,
//   ) {}
//
//   public async findReplenishItemType(): Promise<string[]> {
//     const docs = await this._itemTypeRepository.findMany({
//       isReturn: false,
//     });
//     return docs.map((doc) => doc.type);
//   }
//
//   public async addLogDataToTransaction(transactionId: string, logData: TransactionEntity['locations'][number]): Promise<TransactionEntity> {
//     const result = await this._transactionMRepository.findByIdAndUpdate(
//       transactionId,
//       {
//         $push: { locationsTemp: logData },
//       },
//       {
//         new: true,
//       },
//     );
//
//     return result as any;
//   }
//
//   public async updateTransaction(id: string, entity: Partial<Properties<TransactionEntity>>): Promise<TransactionEntity | null> {
//     const doc = await this._transactionMRepository.findByIdAndUpdate(id, { $set: { ...entity } }, { returnDocument: 'after' });
//     return TransactionMapper.toEntity(doc);
//   }
//
//   public async findDeviceById(id: string): Promise<DeviceEntity | null> {
//     const doc = await this._deviceRepository.findById(id);
//     return DeviceMapper.toEntity(doc);
//   }
//
//   public async findDevicesByBinId(binId: string): Promise<DeviceEntity[]> {
//     const docs = await this._deviceRepository.findMany({
//       binId: new Types.ObjectId(binId),
//     });
//     return DeviceMapper.toEntities(docs);
//   }
//
//   public async updateBinsDamage(binIds: string[]): Promise<boolean> {
//     const docs = await this._binMRepository.updateMany(
//       {
//         _id: { $in: binIds.map((binId) => new Types.ObjectId(binId)) },
//       },
//       {
//         isDamage: true,
//       },
//       {
//         returnDocument: 'after',
//       },
//     );
//     return docs.length === binIds.length;
//   }
//
//   public async findTransactionById(id: string): Promise<TransactionEntity | null> {
//     const doc = await this._transactionMRepository.findById(id);
//     return TransactionMapper.toEntity(doc);
//   }
//
//   public async updateBinOpenStatus(bin: { id: string } & Partial<Properties<BinEntity>>): Promise<BinEntity | null> {
//     const doc = await this._binMRepository.findByIdAndUpdate(
//       bin.id,
//       {
//         $set: {
//           isFailed: bin.isFailed,
//           isLocked: bin.isLocked,
//           isDamage: bin.isDamage,
//           retryCount: bin.retryCount,
//         },
//       },
//       {
//         returnDocument: 'after',
//       },
//     );
//
//     return BinMapper.toEntity(doc);
//   }
//
//   public async createTransaction(entity: TransactionEntity): Promise<TransactionEntity> {
//     const model = TransactionMapper.toModel(entity);
//     const doc = await this._transactionMRepository.create(model);
//     return TransactionMapper.toEntity(doc) as TransactionEntity;
//   }
//
//   public async findBinById(binId: string): Promise<BinEntity | null> {
//     const doc = await this._binMRepository.findById(binId);
//     return BinMapper.toEntity(doc);
//   }
//
//   public async findDeviceByBinId(binId: string): Promise<DeviceEntity | null> {
//     const doc = await this._deviceRepository.findFirst({
//       binId: new Types.ObjectId(binId),
//     });
//     return DeviceMapper.toEntity(doc);
//   }
//
//   public async updateDeviceZeroWeightByBinId(binId: string): Promise<boolean> {
//     const doc: Device = await this._deviceRepository.updateFirst(
//       {
//         binId: new Types.ObjectId(binId),
//       },
//       [
//         {
//           $set: {
//             zeroWeight: '$weight',
//           },
//         },
//       ],
//       {
//         returnDocument: 'after',
//       },
//     );
//
//     return doc.zeroWeight?.toString() === doc.weight?.toString();
//   }
//
//   public async findDevicesWithPort(): Promise<{ device: DeviceEntity; portPath: string }[]> {
//     const docs = await this._deviceRepository.findMany(
//       {},
//       {
//         populate: {
//           path: 'port',
//           model: 'Port',
//           localField: 'portId',
//           foreignField: '_id',
//         },
//       },
//     );
//
//     return docs.map((doc) => {
//       return {
//         device: DeviceMapper.toEntity(doc as any) as DeviceEntity,
//         portPath: (doc as any).port?.path,
//       };
//     });
//   }
//
//   public async updateDevicesDamageQty(deviceIds: string[], damageItems: Array<{ deviceId: string; damageQty: number }>): Promise<void> {
//     // 1. Batch fetch devices (1 query instead of N)
//     const devices = await this._deviceRepository.findMany({
//       _id: { $in: deviceIds.map((id) => new Types.ObjectId(id)) },
//     });
//
//     // 2. Create device update operations
//     const deviceUpdates = devices.map((device) => {
//       // Calculate total damage quantity for this device
//       const totalDamageQty = damageItems.filter((item) => item.deviceId === device.id).reduce((sum, item) => sum + item.damageQty, 0);
//
//       return {
//         updateOne: {
//           filter: { _id: device._id },
//           update: {
//             $inc: { damageQuantity: totalDamageQty },
//           },
//         },
//       };
//     });
//
//     if (deviceUpdates.length > 0) {
//       await this._deviceRepository.bulkWrite(deviceUpdates);
//     }
//   }
// }
