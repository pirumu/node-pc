import { CabinetMRepository } from '@dals/mongo/repositories';

import { ICabinetRepository } from '../cabinet.repository';
import { CabinetEntity } from '@entity';
import { BinMapper, CabinetMapper } from '@mapper';
import { Bin } from '@dals/mongo/schema/bin.schema';
import { Cabinet } from '@dals/mongo/schema/cabinet.schema';
import { CabinetBinEntity } from '@entity/cabinet-bin.entity';
import { Injectable } from '@nestjs/common';

@Injectable()
export class CabinetImplRepository implements ICabinetRepository {
  constructor(private readonly _repository: CabinetMRepository) {}

  public async findAll(): Promise<CabinetEntity[]> {
    const results = await this._repository.findMany({});
    return CabinetMapper.toEntities(results);
  }

  public async findComplexById(id: string | number): Promise<CabinetBinEntity | null> {
    const pipeline: any[] = [
      // Match cabinet by ID - flexible matching
      {
        $match: { _id: id },
      },

      // Lookup bins
      {
        $lookup: {
          from: 'bins',
          localField: '_id',
          foreignField: 'cabinetId',
          as: 'bins',
          pipeline: [
            // Lookup devices for each bin to calculate quantities
            {
              $lookup: {
                from: 'devices',
                localField: '_id',
                foreignField: 'binId',
                as: 'devices',
              },
            },

            // Lookup bin-items relationship
            {
              $lookup: {
                from: 'binitems',
                localField: '_id',
                foreignField: 'binId',
                as: 'binItems',
              },
            },

            // Lookup items through bin-items
            {
              $lookup: {
                from: 'items',
                localField: 'binItems.itemId',
                foreignField: '_id',
                as: 'items',
              },
            },

            // Lookup loadcells (devices)
            {
              $lookup: {
                from: 'devices',
                localField: '_id',
                foreignField: 'binId',
                as: 'loadcells',
                pipeline: [
                  // Lookup ports for each device
                  {
                    $lookup: {
                      from: 'ports',
                      localField: 'portId',
                      foreignField: '_id',
                      as: 'port',
                    },
                  },
                  {
                    $unwind: {
                      path: '$port',
                      preserveNullAndEmptyArrays: true,
                    },
                  },
                  // Project device fields
                  {
                    $project: {
                      id: '$_id',
                      deviceId: 1,
                      quantity: 1,
                      calcQuantity: 1,
                      damageQuantity: 1,
                      quantityMinThreshold: 1,
                      quantityCritThreshold: 1,
                      itemId: 1,
                      status: 1,
                      weight: 1,
                      zeroWeight: 1,
                      calcWeight: 1,
                      unitWeight: 1,
                      port: {
                        id: '$port._id',
                        name: '$port.name',
                        path: '$port.path',
                      },
                    },
                  },
                ],
              },
            },

            // Add computed fields
            {
              $addFields: {
                // Convert _id to id
                id: '$_id',

                // Calculate totalLoadcells (count of devices)
                totalLoadcells: { $size: '$devices' },

                // Calculate quantityOh (sum of devices.quantity)
                quantityOh: {
                  $reduce: {
                    input: '$devices',
                    initialValue: 0,
                    in: { $add: ['$value', { $ifNull: ['$this.quantity', 0] }] },
                  },
                },

                // Calculate quantity (sum of devices.calcQuantity)
                quantity: {
                  $reduce: {
                    input: '$devices',
                    initialValue: 0,
                    in: { $add: ['$value', { $ifNull: ['$this.calcQuantity', 0] }] },
                  },
                },

                // Calculate quantityDamage (sum of devices.damageQuantity)
                quantityDamage: {
                  $reduce: {
                    input: '$devices',
                    initialValue: 0,
                    in: { $add: ['$value', { $ifNull: ['$this.damageQuantity', 0] }] },
                  },
                },

                // Process items with binItems data
                items: {
                  $map: {
                    input: '$items',
                    as: 'item',
                    in: {
                      $mergeObjects: [
                        '$item',
                        {
                          id: '$item._id',
                          binItem: {
                            $arrayElemAt: [
                              {
                                $filter: {
                                  input: '$binItems',
                                  cond: { $eq: ['$this.itemId', '$item._id'] },
                                },
                              },
                              0,
                            ],
                          },
                        },
                      ],
                    },
                  },
                },
              },
            },

            // Add additional computed fields (nameItems, itemConfigureNames, isLinkLoadcell)
            {
              $addFields: {
                nameItems: '$items.name',
                itemConfigureNames: {
                  $map: {
                    input: '$items',
                    as: 'item',
                    in: {
                      $concat: ['$cabinet.name', '_', { $toString: '$row' }, '_', '$name', '_', '$item.name', '_', '$item.partNo'],
                    },
                  },
                },
                isLinkLoadcell: { $size: '$loadcells' },
              },
            },

            // Project bin fields - convert all to camelCase
            {
              $project: {
                id: 1,
                name: 1,
                cuId: 1,
                lockId: 1,
                totalLoadcells: 1,
                row: 1,
                min: 1,
                max: 1,
                critical: 1,
                isProcessing: 1,
                isLocked: 1,
                isFailed: 1,
                isRfid: 1,
                isDrawer: 1,
                isDamage: 1,
                status: 1,
                newMax: 1,
                isCalibrated: 1,
                quantityOh: 1,
                quantity: 1,
                quantityDamage: 1,
                nameItems: 1,
                itemConfigureNames: 1,
                isLinkLoadcell: 1,
                items: {
                  $map: {
                    input: '$items',
                    as: 'item',
                    in: {
                      id: '$item._id',
                      name: '$item.name',
                      partNo: '$item.partNo',
                      materialNo: '$item.materialNo',
                      itemTypeId: '$item.itemTypeId',
                      type: '$item.type',
                      binItem: {
                        id: '$item.binItem._id',
                        min: '$item.binItem.min',
                        max: '$item.binItem.max',
                        critical: '$item.binItem.critical',
                        serialNo: '$item.binItem.serialNo',
                        expiryDate: '$item.binItem.expiryDate',
                        calibrationDue: '$item.binItem.calibrationDue',
                      },
                    },
                  },
                },
                loadcells: 1,
              },
            },

            // Sort bins by id
            { $sort: { id: 1 } },
          ],
        },
      },

      // Lookup cabinet name for itemConfigureNames
      {
        $addFields: {
          bins: {
            $map: {
              input: '$bins',
              as: 'bin',
              in: {
                $mergeObjects: [
                  '$$bin',
                  {
                    itemConfigureNames: {
                      $map: {
                        input: '$$bin.items',
                        as: 'item',
                        in: {
                          $concat: ['$name', '_', { $toString: '$bin.row' }, '_', '$bin.name', '_', '$item.name', '_', '$item.partNo'],
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },

      // Project final cabinet fields according to ICabinet interface
      {
        $project: {
          id: '$_id',
          name: 1,
          code: 1,
          type: 1,
          numberOfRows: '$numberOfRows',
          totalBins: '$totalBins',
          status: 1,
          bins: 1,
        },
      },
    ];

    const result = await this._repository.aggregate<Cabinet & { bins: Bin[] }>(pipeline);

    if (!result || result.length === 0) {
      return null;
    }

    const { bins, ...cabinet } = result[0];

    return new CabinetBinEntity({
      id: cabinet.id,
      name: cabinet.name,
      code: cabinet.code,
      type: cabinet.type,
      bins: BinMapper.toEntities(bins),
      createdAt: cabinet.createdAt?.toISOString(),
      updatedAt: cabinet.updatedAt?.toISOString(),
    });
  }
}
