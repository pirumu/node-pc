import { FilterGroupBuilder, PipelineStageBuilder } from '@dals/mongo';
import { AreaMRepository, ItemMRepository, JobCardMRepository, ReturnItemMRepository } from '@dals/mongo/repositories';
import { IssueItemEntity } from '@entity/item.entity';
import { QueryOperator } from '@framework/types';
import { Injectable, Logger } from '@nestjs/common';

import { IItemRepository } from '../item.repository';
import { DeviceMapper, ReturnItemMapper } from '@mapper';
import { DeviceEntity, ReturnItemEntity } from '@entity';
import { Device } from '@dals/mongo/schema/device.schema';
import { Types } from 'mongoose';

@Injectable()
export class ItemImplRepository implements IItemRepository {
  private readonly _logger = new Logger(ItemImplRepository.name);
  constructor(
    private readonly _repository: ItemMRepository,
    private readonly _returnItemRepository: ReturnItemMRepository,
    private readonly _jobCardRepository: JobCardMRepository,
    private readonly _areaRepository: AreaMRepository,
  ) {}

  public async getIssueItems(filters: { type?: string; keyword?: string; dateThreshold: Date }): Promise<IssueItemEntity[]> {
    const { type, keyword, dateThreshold } = filters;

    const itemMatchConditions = FilterGroupBuilder.build({
      filters: type
        ? [
            {
              field: 'type',
              operator: QueryOperator.EQUAL,
              value: type,
            },
          ]
        : [],
      filterGroups: keyword
        ? [
            {
              logic: 'OR',
              conditions: [
                {
                  field: 'partNo',
                  operator: QueryOperator.REGEX,
                  value: keyword,
                  options: {
                    caseSensitive: false,
                  },
                },
                {
                  field: 'name',
                  operator: QueryOperator.REGEX,
                  value: keyword,
                  options: {
                    caseSensitive: false,
                  },
                },
              ],
            },
          ]
        : [],
    });

    const pipeline: PipelineStageBuilder[] = [
      {
        $match: itemMatchConditions,
      },
      {
        $lookup: {
          from: 'devices',
          let: { itemId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$itemId', '$$itemId'] }, { $gt: [{ $ifNull: ['$quantity', 0] }, 0] }],
                },
              },
            },
            { $limit: 1 },
          ],
          as: 'hasValidDevices',
        },
      },
      {
        $match: {
          ['hasValidDevices.0']: { $exists: true },
        },
      },
      {
        $lookup: {
          from: 'binitems',
          let: { itemId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$itemId', '$$itemId'] },
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
            { $limit: 1 },
          ],
          as: 'hasValidBinItems',
        },
      },
      {
        $match: {
          ['hasValidBinItems.0']: { $exists: true },
        },
      },
      {
        $lookup: {
          from: 'devices',
          let: { itemId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$itemId', '$$itemId'] }, { $gt: [{ $ifNull: ['$quantity', 0] }, 0] }],
                },
              },
            },
            {
              $lookup: {
                from: 'bins',
                let: { binId: '$binId' },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [{ $eq: ['$_id', '$$binId'] }, { $eq: ['$isFailed', false] }, { $ne: ['$isDamage', true] }],
                      },
                    },
                  },
                  {
                    $lookup: {
                      from: 'cabinets',
                      localField: 'cabinetId',
                      foreignField: '_id',
                      as: 'cabinet',
                    },
                  },
                  { $unwind: { path: '$cabinet', preserveNullAndEmptyArrays: true } },
                  {
                    $lookup: {
                      from: 'binitems',
                      let: { binId: '$_id', checkItemId: '$$itemId' },
                      pipeline: [
                        {
                          $match: {
                            $expr: {
                              $and: [
                                { $eq: ['$binId', '$$binId'] },
                                { $eq: ['$itemId', '$$checkItemId'] },
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
                      as: 'binItemsForBin',
                    },
                  },
                ],
                as: 'bin',
              },
            },
            { $unwind: { path: '$bin', preserveNullAndEmptyArrays: false } },
            {
              $match: {
                ['bin.binItemsForBin.0']: { $exists: true },
              },
            },
          ],
          as: 'validDevices',
        },
      },
      {
        $match: {
          ['validDevices.0']: { $exists: true },
        },
      },

      { $unwind: '$validDevices' },

      {
        $addFields: {
          dueDate: {
            $arrayElemAt: ['$validDevices.bin.binItemsForBin.expiryDate', 0],
          },
        },
      },

      {
        $project: {
          id: '$_id',
          name: 1,
          partNo: 1,
          materialNo: 1,
          itemTypeId: 1,
          type: 1,
          image: 1,
          description: 1,
          createdAt: 1,
          updatedAt: 1,
          locations: ['$validDevices.bin.name'],
          totalQuantity: '$validDevices.quantity',
          totalCalcQuantity: '$validDevices.calcQuantity',
          binId: '$validDevices.bin._id',
          dueDate: 1,
        },
      },

      { $sort: { name: 1 } },
    ];

    return this._repository.aggregate<IssueItem>(pipeline);
  }

  public async getItemsForIssue(
    itemRequests: Array<{ itemId: number; binId: number; quantity: number; listWO: any[] }>,
    dateThreshold: Date,
  ): Promise<
    Array<{
      id: string;
      name: string;
      partNo: number;
      materialNo: number;
      itemTypeId: string;
      type: string;
      requestedBinId: string;
      devices: DeviceEntity[];
    }>
  > {
    const itemIds = itemRequests.map((req) => req.itemId);
    const binIds = itemRequests.map((req) => req.binId);

    const pipeline = [
      { $match: { _id: { $in: itemIds } } },
      {
        $addFields: {
          requestedBinIds: binIds,
        },
      },
      {
        $lookup: {
          from: 'devices',
          let: {
            itemId: '$_id',
            requestedBinIds: '$requestedBinIds',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$itemId', '$itemId'] },
                    { $gt: [{ $ifNull: ['$quantity', 0] }, 0] },
                    { $in: ['$binId', '$requestedBinIds'] },
                  ],
                },
              },
            },
            {
              $lookup: {
                from: 'bins',
                let: { binId: '$binId' },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [{ $eq: ['$_id', '$binId'] }, { $eq: ['$isFailed', false] }, { $ne: ['$isDamage', true] }],
                      },
                    },
                  },
                  {
                    $lookup: {
                      from: 'cabinets',
                      localField: 'cabinetId',
                      foreignField: '_id',
                      as: 'cabinet',
                    },
                  },
                  { $unwind: '$cabinet' },
                ],
                as: 'bin',
              },
            },
            { $unwind: { path: '$bin', preserveNullAndEmptyArrays: false } },
            {
              $lookup: {
                from: 'binitems',
                let: {
                  binId: '$binId',
                  checkItemId: '$itemId',
                },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $eq: ['$binId', '$binId'] },
                          { $eq: ['$itemId', '$checkItemId'] },
                          {
                            $or: [{ $gte: ['$expiryDate', dateThreshold] }, { $eq: ['$expiryDate', null] }],
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
          ],
          as: 'allDevices',
        },
      },
      {
        $unwind: {
          path: '$requestedBinIds',
          includeArrayIndex: 'binIndex',
        },
      },
      {
        $addFields: {
          requestedBinId: '$requestedBinIds',
        },
      },
      {
        $addFields: {
          devices: {
            $filter: {
              input: '$allDevices',
              cond: { $eq: ['$this.binId', '$requestedBinId'] },
            },
          },
        },
      },
      {
        $addFields: {
          devices: {
            $sortArray: {
              input: '$devices',
              sortBy: { binId: 1 },
            },
          },
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          partNo: 1,
          materialNo: 1,
          itemTypeId: 1,
          type: 1,
          requestedBinId: 1,
          devices: 1,
        },
      },
    ];

    const results = await this._repository.aggregate<{
      _id: Types.ObjectId;
      name: string;
      partNo: number;
      materialNo: number;
      itemTypeId: string;
      type: string;
      requestedBinId: string;
      devices: Device[];
    }>(pipeline);

    return results.map((r) => ({
      id: r._id.toString(),
      name: r.name,
      partNo: r.partNo,
      materialNo: r.materialNo,
      itemTypeId: r.itemTypeId,
      type: r.type,
      requestedBinId: r.requestedBinId,
      devices: DeviceMapper.toEntities(r.devices),
    }));
  }

  public async getReturnItemHistory(userId: number, itemIds: number[]): Promise<Map<string, ReturnItemEntity>> {
    const returnItems = await this._returnItemRepository.findMany({
      userId,
      itemId: { $in: itemIds },
    });

    const entities = ReturnItemMapper.toEntities(returnItems);

    const returnHistoryMap = new Map<string, ReturnItemEntity>();
    entities.forEach((item) => {
      returnHistoryMap.set(item.itemId, item);
    });
    return returnHistoryMap;
  }

  public async getReturnItem(data: { itemId: string; userId: string; binId: string }): Promise<ReturnItemEntity | null> {
    const doc = await this._returnItemRepository.findFirst({
      id: data.itemId,
      userId: data.userId,
      binId: data.binId,
    });
    return ReturnItemMapper.toEntity(doc);
  }

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
}
