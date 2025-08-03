import { PROCESS_ITEM_TYPE } from '@common/constants';
import { AreaMRepository, ItemMRepository, ItemTypeMRepository, JobCardMRepository, ReturnItemMRepository } from '@dals/mongo/repositories';
import { IssueItemEntity } from '@entity/item.entity';
import { Injectable, Logger } from '@nestjs/common';
import { PipelineStage, Types } from 'mongoose';

import { IItemRepository } from '../item.repository';

@Injectable()
export class ItemImplRepository implements IItemRepository {
  private readonly _logger = new Logger(ItemImplRepository.name);
  constructor(
    private readonly _repository: ItemMRepository,
    private readonly _itemTypeRepository: ItemTypeMRepository,
    private readonly _returnItemRepository: ReturnItemMRepository,
    private readonly _jobCardRepository: JobCardMRepository,
    private readonly _areaRepository: AreaMRepository,
  ) {}

  public async getIssueItems(filters: { type?: string; keyword?: string; dateThreshold: Date }): Promise<IssueItemEntity[]> {
    const { keyword, type, dateThreshold } = filters;

    const matchConditions: Record<string, any> = {};
    if (keyword) {
      matchConditions.$or = [{ partNo: { $regex: keyword, $options: 'i' } }, { name: { $regex: keyword, $options: 'i' } }];
    }
    if (type) {
      matchConditions.type = type;
    }

    const pipeline: PipelineStage[] = [
      { $match: matchConditions },
      {
        $lookup: {
          from: 'devices',
          let: { itemId: '$_id' },
          as: 'validDevices',
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$itemId', '$$itemId'] }, { $gt: ['$quantity', 0] }],
                },
              },
            },
            {
              $lookup: {
                from: 'bins',
                let: { binId: '$binId' },
                as: 'bin',
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [{ $eq: ['$_id', '$$binId'] }, { $ne: ['$isFailed', true] }, { $ne: ['$isDamage', true] }],
                      },
                    },
                  },
                ],
              },
            },
            { $unwind: '$bin' },
          ],
        },
      },
      { $unwind: '$validDevices' },
      {
        $lookup: {
          from: 'binitems',
          let: {
            itemId: '$_id',
            binId: '$validDevices.bin._id',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$itemId', '$$itemId'] },
                    { $eq: ['$binId', '$$binId'] },
                    {
                      $or: [{ $gte: ['$expiryDate', dateThreshold] }, { $eq: ['$expiryDate', null] }, { $eq: ['$expiryDate', undefined] }],
                    },
                  ],
                },
              },
            },
            {
              $lookup: {
                from: 'bins',
                pipeline: [
                  {
                    $match: {
                      $expr: { $eq: ['$_id', '$$binId'] },
                    },
                  },
                ],
                as: 'bin',
              },
            },
            { $unwind: '$bin' },
          ],
          as: 'validBinItems',
        },
      },
      { $match: { ['validBinItems.0']: { $exists: true } } },
      {
        $project: {
          _id: 1,
          name: 1,
          partNo: 1,
          materialNo: 1,
          itemTypeId: 1,
          type: 1,
          image: 1,
          description: 1,
          createdAt: 1,
          updatedAt: 1,
          totalQuantity: '$validDevices.quantity',
          totalCalcQuantity: '$validDevices.calcQuantity',
          binId: '$validDevices.bin._id',
          locations: ['$validDevices.bin.name'],
          dueDate: { $arrayElemAt: ['$validBinItems.expiryDate', 0] },
        },
      },
      { $sort: { name: 1 } },
    ];

    const items = await this._repository.aggregate<{
      _id: Types.ObjectId;
      name: string;
      partNo: string;
      materialNo: string;
      itemTypeId: string;
      type: string;
      image: string;
      description: string;
      createdAt: Date;
      updatedAt: Date;
      totalQuantity: number;
      totalCalcQuantity: number;
      binId: string;
      locations: string[];
      dueDate: Date;
    }>(pipeline);
    return items.map(
      (i) =>
        new IssueItemEntity({
          id: i._id.toString(),
          name: i.name,
          partNo: i.partNo,
          materialNo: i.materialNo,
          itemTypeId: i.itemTypeId.toString(),
          type: i.type,
          image: i.image,
          description: i.description,
          createdAt: i.createdAt?.toISOString(),
          updatedAt: i.updatedAt?.toISOString(),
          totalQuantity: i.totalQuantity,
          totalCalcQuantity: i.totalCalcQuantity,
          binId: i.binId.toString(),
          locations: i.locations,
          dueDate: i.dueDate?.toISOString(),
        }),
    );
  }

  public async getItemsForIssue(filters: {
    processBy: string;
    itemIds: string[];
    binIds: string[];
    dateThreshold: Date;
  }): Promise<IssueItemEntity[]> {
    const { itemIds, binIds, dateThreshold, processBy } = filters;

    const itemMIds = itemIds.map((id) => new Types.ObjectId(id));
    const binMIds = binIds.map((id) => new Types.ObjectId(id));

    const pipeline: PipelineStage[] = [
      {
        $match: {
          _id: { $in: itemMIds },
        },
      },
      {
        $lookup: {
          from: 'devices',
          let: { itemId: '$_id' },
          as: 'devices',
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$itemId', '$$itemId'] }, { $gt: ['$quantity', 0] }, { $in: ['$binId', binMIds] }],
                },
              },
            },
            { $sort: { binId: 1 } },
          ],
        },
      },
      { $unwind: '$devices' },
      {
        $lookup: {
          from: 'bins',
          let: { binId: '$devices.binId' },
          as: 'bin',
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$_id', '$$binId'] }, { $eq: ['$isFailed', false] }, { $eq: ['$isDamage', false] }],
                },
              },
            },
          ],
        },
      },
      { $unwind: '$bin' },
      {
        $lookup: {
          from: 'cabinets',
          let: { cabinetId: '$bin.cabinetId' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$_id', '$$cabinetId'] },
              },
            },
          ],
          as: 'cabinet',
        },
      },
      { $unwind: '$cabinet' },
      {
        $lookup: {
          from: 'binitems',
          let: {
            itemId: '$_id',
            binId: '$bin._id',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$itemId', '$$itemId'] },
                    { $eq: ['$binId', '$$binId'] },
                    {
                      $or: [
                        { $gte: ['$expiryDate', dateThreshold] },
                        { $eq: ['$expiryDate', null] },
                        { $not: { $ifNull: ['$expiryDate', false] } },
                      ],
                    },
                  ],
                },
              },
            },
          ],
          as: 'validBinItems',
        },
      },
      {
        $match: {
          ['validBinItems.0']: { $exists: true },
        },
      },
      {
        $lookup: {
          from: 'returnitems',
          let: {
            itemId: '$_id',
            binId: '$bin._id',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$userId', new Types.ObjectId(processBy)] }, { $eq: ['$itemId', '$$itemId'] }],
                },
              },
            },
            {
              $addFields: {
                matchingLocation: {
                  $filter: {
                    input: '$locations',
                    cond: {
                      $eq: ['$$this.bin.id', { $toString: '$$binId' }],
                    },
                  },
                },
              },
            },
            {
              $project: {
                location: { $arrayElemAt: ['$matchingLocation', 0] },
                _id: 0,
              },
            },
            {
              $match: {
                location: { $exists: true, $ne: null },
              },
            },
          ],
          as: 'userReturnData',
        },
      },
      {
        $group: {
          _id: '$_id',
          name: { $first: '$name' },
          itemTypeId: { $first: '$itemTypeId' },
          type: { $first: '$type' },
          partNo: { $first: '$partNo' },
          materialNo: { $first: '$materialNo' },
          locations: {
            $push: {
              cabinet: {
                id: '$cabinet._id',
                name: '$cabinet.name',
              },
              bin: {
                id: '$bin._id',
                name: '$bin.name',
                row: '$bin.row',
              },
              pre_qty: '$devices.quantity',
              userReturnLocation: {
                $arrayElemAt: ['$userReturnData.location', 0],
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          itemTypeId: 1,
          type: 1,
          partNo: 1,
          materialNo: 1,
          image: 1,
          description: 1,
          createdAt: 1,
          updatedAt: 1,
          locations: 1,
          binIds: {
            $map: {
              input: '$locations',
              in: '$$this.bin.id',
            },
          },
          locationNames: {
            $map: {
              input: '$locations',
              in: '$$this.bin.name',
            },
          },
          dueDate: {
            $min: {
              $map: {
                input: '$locations',
                in: '$$this.binItemInfo.expiryDate',
              },
            },
          },
        },
      },
    ];

    const items = await this._repository.aggregate<{
      _id: Types.ObjectId;
      name: string;
      locations: string[];
    }>(pipeline);

    return items.map((i) => {
      return {
        id: i._id.toString(),
        name: i.name,
        locations: i.locations,
      } as any;
    });
  }

  // public async getReturnItemHistory(userId: number, itemIds: number[]): Promise<Map<string, ReturnItemEntity>> {
  //   const returnItems = await this._returnItemRepository.findMany({
  //     userId,
  //     itemId: { $in: itemIds },
  //   });
  //
  //   const entities = ReturnItemMapper.toEntities(returnItems);
  //
  //   const returnHistoryMap = new Map<string, ReturnItemEntity>();
  //   entities.forEach((item) => {
  //     returnHistoryMap.set(item.itemId, item);
  //   });
  //   return returnHistoryMap;
  // }
  //
  // public async getReturnItem(data: { itemId: string; userId: string; binId: string }): Promise<ReturnItemEntity | null> {
  //   const doc = await this._returnItemRepository.findFirst({
  //     id: data.itemId,
  //     userId: data.userId,
  //     binId: data.binId,
  //   });
  //   return ReturnItemMapper.toEntity(doc);
  // }

  public async enrichWorkOrder(rawWorkOrders: { woId: string; areaId: string }[]): Promise<any[]> {
    if (rawWorkOrders.length === 0) {
      return [];
    }

    const jobCardIds = new Set<string>();
    const areaIds = new Set<string>();
    rawWorkOrders.forEach((item) => {
      jobCardIds.add(item.woId);
      areaIds.add(item.areaId);
    });

    const [jobCardDocs, areaDocs] = await Promise.all([
      this._jobCardRepository.findMany({
        _id: { $in: Array.from(jobCardIds) },
      }),
      this._areaRepository.findMany({
        _id: { $in: Array.from(areaIds) },
      }),
    ]);

    const jobCardsMap = new Map(jobCardDocs.map((doc) => [doc._id.toString(), doc]));
    const areasMap = new Map(areaDocs.map((doc) => [doc._id.toString(), doc]));

    return rawWorkOrders
      .map((item) => {
        const jobCard = jobCardsMap.get(item.woId);
        const area = areasMap.get(item.areaId);

        if (!jobCard || !area) {
          this._logger.warn(`Could not find JobCard for id ${item.woId} or Area for id ${item.areaId}`);
          return null;
        }

        return {
          woId: jobCard._id.toString(),
          areaId: area._id.toString(),
          wo: jobCard.wo,
          vehicleId: jobCard.vehicleId,
          platform: jobCard.platform,
          torque: area.torque,
          area: area.name,
        };
      })
      .filter(Boolean);
  }

  public async getItemsByType(type: PROCESS_ITEM_TYPE) {
    const pipeline: PipelineStage[] = [
      {
        $match: {
          ...(type === PROCESS_ITEM_TYPE.ISSUE && { isIssue: true }),
          ...(type === PROCESS_ITEM_TYPE.RETURN && { isReturn: true }),
          ...(type === PROCESS_ITEM_TYPE.REPLENISH && { isReplenish: true }),
        },
      },
      {
        $lookup: {
          from: 'items',
          localField: '_id',
          foreignField: 'itemTypeId',
          as: 'items',
        },
      },
      ...(type === PROCESS_ITEM_TYPE.ISSUE
        ? [
            {
              $addFields: {
                validItems: {
                  $filter: {
                    input: '$items',
                    as: 'item',
                    cond: {
                      $gt: [
                        {
                          $size: {
                            $ifNull: ['$$item.binItems', []],
                          },
                        },
                        0,
                      ],
                    },
                  },
                },
              },
            },
            {
              $lookup: {
                from: 'binitems',
                let: { itemIds: '$items._id' },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $in: ['$itemId', '$$itemIds'],
                      },
                    },
                  },
                  {
                    $group: {
                      _id: '$itemId',
                    },
                  },
                ],
                as: 'itemsWithBins',
              },
            },
            {
              $match: {
                ['itemsWithBins.0']: { $exists: true },
              },
            },
          ]
        : type === PROCESS_ITEM_TYPE.RETURN
          ? [
              {
                $lookup: {
                  from: 'returnitems',
                  let: { itemIds: '$items._id' },
                  pipeline: [
                    {
                      $match: {
                        $expr: {
                          $in: ['$itemId', '$$itemIds'],
                        },
                      },
                    },
                    {
                      $group: {
                        _id: '$itemId',
                      },
                    },
                  ],
                  as: 'itemsWithReturns',
                },
              },
              {
                $match: {
                  ['itemsWithReturns.0']: { $exists: true },
                },
              },
            ]
          : type === PROCESS_ITEM_TYPE.REPLENISH
            ? [
                {
                  $addFields: {
                    itemsNeedingReplenish: {
                      $filter: {
                        input: '$items',
                        as: 'item',
                        cond: {
                          $let: {
                            vars: {
                              totalQty: {
                                $sum: {
                                  $map: {
                                    input: { $ifNull: ['$$item.devices', []] },
                                    in: { $ifNull: ['$$this.quantity', 0] },
                                  },
                                },
                              },
                              totalCalcQty: {
                                $sum: {
                                  $map: {
                                    input: { $ifNull: ['$$item.devices', []] },
                                    in: { $ifNull: ['$$this.calcQuantity', 0] },
                                  },
                                },
                              },
                            },
                            in: { $lt: ['$$totalQty', '$$totalCalcQty'] },
                          },
                        },
                      },
                    },
                  },
                },
                {
                  $lookup: {
                    from: 'devices',
                    let: { itemIds: '$items._id' },
                    pipeline: [
                      {
                        $match: {
                          $expr: {
                            $in: ['$itemId', '$$itemIds'],
                          },
                        },
                      },
                      {
                        $group: {
                          _id: '$itemId',
                          totalQuantity: { $sum: { $ifNull: ['$quantity', 0] } },
                          totalCalcQuantity: { $sum: { $ifNull: ['$calcQuantity', 0] } },
                        },
                      },
                      {
                        $match: {
                          $expr: {
                            $lt: ['$totalQuantity', '$totalCalcQuantity'],
                          },
                        },
                      },
                    ],
                    as: 'itemsNeedingReplenish',
                  },
                },
                {
                  $match: {
                    ['itemsNeedingReplenish.0']: { $exists: true },
                  },
                },
              ]
            : []),

      {
        $lookup: {
          from: 'items',
          pipeline: [{ $group: { _id: '$type' } }, { $project: { type: '$_id', _id: 0 } }],
          as: 'existingTypes',
        },
      },
      {
        $addFields: {
          existingTypesList: {
            $map: {
              input: '$existingTypes',
              in: '$$this.type',
            },
          },
        },
      },
      {
        $match: {
          $expr: {
            $in: ['$type', '$existingTypesList'],
          },
        },
      },
      {
        $project: {
          type: 1,
          _id: 0,
        },
      },

      {
        $sort: { type: 1 },
      },
    ];

    const types = await this._itemTypeRepository.aggregate<any>(pipeline);
    return types;
  }
}
