// import { Injectable } from '@nestjs/common';
// import { InjectModel } from '@nestjs/mongoose';
// import { Model } from 'mongoose';
//
// @Injectable()
// export class CabinetServiceAlternative {
//   constructor(
//     @InjectModel('Cabinet') private cabinetModel: Model<any>,
//     @InjectModel('Bin') private binModel: Model<any>,
//     @InjectModel('Device') private deviceModel: Model<any>,
//     @InjectModel('Item') private itemModel: Model<any>,
//     @InjectModel('BinItem') private binItemModel: Model<any>,
//     @InjectModel('Port') private portModel: Model<any>,
//   ) {}
//
//   async getCabinetByIdAlternative(id: string) {
//     try {
//       // Find cabinet
//       const cabinet = await this.cabinetModel.findById(id).select({
//         id: true,
//         name: true,
//       });
//
//       if (!cabinet) {
//         return null;
//       }
//
//       // Find bins with basic info
//       const bins = await this.binModel
//         .find({ cabinet_id: cabinet._id })
//         .select([
//           'id',
//           'name',
//           'cu_id',
//           'lock_id',
//           'row',
//           'min',
//           'max',
//           'critical',
//           'is_processing',
//           'is_locked',
//           'is_failed',
//           'is_rfid',
//           'is_drawer',
//           'is_damage',
//           'status',
//           'new_max',
//           'is_calibrated',
//         ])
//         .sort({ id: 1 });
//
//       // Process each bin
//       for (const bin of bins) {
//         // Get devices for calculations
//         const devices = await this.deviceModel.find({ bin_id: bin._id });
//
//         // Calculate aggregated values
//         bin.total_loadcells = devices.length;
//         bin.quantity_oh = devices.reduce((sum, device) => sum + (device.quantity || 0), 0);
//         bin.quantity = devices.reduce((sum, device) => sum + (device.calc_quantity || 0), 0);
//         bin.quantity_damage = devices.reduce((sum, device) => sum + (device.damage_quantity || 0), 0);
//
//         // Get items through bin_items
//         const binItems = await this.binItemModel.find({ bin_id: bin._id });
//         const itemIds = binItems.map((bi) => bi.item_id);
//         const items = await this.itemModel.find({ _id: { $in: itemIds } });
//
//         // Merge items with binItems data
//         bin.items = items.map((item) => {
//           const binItem = binItems.find((bi) => bi.item_id.equals(item._id));
//           return {
//             ...item.toObject(),
//             id: item._id,
//             binItem: {
//               id: binItem._id,
//               min: binItem.min,
//               max: binItem.max,
//               critical: binItem.critical,
//               serial_no: binItem.serial_no,
//               expiry_date: binItem.expiry_date,
//               calibration_due: binItem.calibration_due,
//             },
//           };
//         });
//
//         // Get loadcells with ports
//         const loadcells = await this.deviceModel
//           .find({ bin_id: bin._id })
//           .select([
//             'id',
//             'device_id',
//             'quantity',
//             'calc_quantity',
//             'damage_quantity',
//             'quantity_min_threshold',
//             'quantity_crit_threshold',
//             'item_id',
//             'status',
//             'weight',
//             'zero_weight',
//             'calc_weight',
//             'unit_weight',
//           ]);
//
//         // Get ports for loadcells
//         for (const loadcell of loadcells) {
//           if (loadcell.port_id) {
//             const port = await this.portModel.findById(loadcell.port_id).select('id name path');
//             loadcell.port = port;
//           }
//         }
//
//         bin.loadcells = loadcells;
//
//         // Add computed fields
//         const nameItems = bin.items.map((item) => item.name);
//         const itemConfigureNames = bin.items.map((item) => `${cabinet.name}_${bin.row}_${bin.name}_${item.name}_${item.part_no}`);
//
//         bin.nameItems = nameItems;
//         bin.itemConfigureNames = itemConfigureNames;
//         bin.isLinkLoadcell = bin.loadcells.length;
//       }
//
//       return {
//         ...cabinet.toObject(),
//         id: cabinet._id,
//         bins: bins,
//       };
//     } catch (error) {
//       throw new Error(`Error getting cabinet by ID: ${error.message}`);
//     }
//   }
// }
