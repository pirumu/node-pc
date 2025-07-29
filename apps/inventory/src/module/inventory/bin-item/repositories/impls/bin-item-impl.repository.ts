import { BinMRepository } from '@dals/mongo/repositories';
import { BinItemWithIdAndName } from '@entity';
import { Injectable } from '@nestjs/common';
import { PipelineStage } from 'mongoose';

import { IBinItemRepository } from '../bin-item.repository';

@Injectable()
export class BinItemImplRepository implements IBinItemRepository {
  constructor(private readonly _repository: BinMRepository) {}

  public async findAll(filter: { keyword?: string }): Promise<BinItemWithIdAndName[]> {
    const { keyword } = filter;
    const pipeline: PipelineStage[] = [
      ...(keyword
        ? [
            {
              $match: {
                $or: [
                  { name: { $regex: keyword, $options: 'i' } },
                  { $expr: { $regexMatch: { input: { $toString: '$row' }, regex: keyword, options: 'i' } } },
                ],
              },
            },
          ]
        : []),
      {
        $lookup: {
          from: 'cabinets',
          localField: 'cabinetId',
          foreignField: '_id',
          as: 'cabinet',
        },
      },
      { $unwind: '$cabinet' },
      {
        $lookup: {
          from: 'binitems',
          localField: '_id',
          foreignField: 'binId',
          as: 'binItems',
        },
      },
      { $unwind: { path: '$binItems', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'items',
          localField: 'binItems.itemId',
          foreignField: '_id',
          as: 'item',
        },
      },
      { $unwind: { path: '$item', preserveNullAndEmptyArrays: true } },

      { $sort: { ['binItems.order']: 1 } },
      {
        $addFields: {
          resultId: {
            $concat: [{ $toString: '$_id' }, '_', { $toString: '$item._id' }],
          },
          resultName: {
            $concat: ['$cabinet.name', '_', { $toString: '$row' }, '_', '$name', '_', '$item.name', '_', '$item.partNo'],
          },
        },
      },
      ...(keyword
        ? [
            {
              $match: {
                resultName: { $regex: keyword, $options: 'i' },
              },
            },
          ]
        : []),
      {
        $project: {
          _id: 0,
          id: '$resultId',
          name: '$resultName',
        },
      },
      {
        $match: {
          id: { $ne: null },
          name: { $ne: null },
        },
      },
    ];

    const result = await this._repository.aggregate<{ id: string; name: string }>(pipeline);
    return result.map((r) => new BinItemWithIdAndName(r));
  }
}
