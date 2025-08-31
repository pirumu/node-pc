import { PaginatedResult, PaginationMeta } from '@common/dto';
import { PortEntity, PortStatus } from '@dals/mongo/entities';
import { EntityRepository, FindOptions, ObjectId } from '@mikro-orm/mongodb';
import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable } from '@nestjs/common';
import { FilterQuery } from 'mongoose';

@Injectable()
export class PortService {
  constructor(@InjectRepository(PortEntity) private readonly _portRepository: EntityRepository<PortEntity>) {}

  public async getPorts(
    page: number,
    limit: number,
    filter: {
      portId?: string;
      status?: PortStatus;
    },
  ): Promise<PaginatedResult<PortEntity>> {
    const { status, portId } = filter;

    const matchStage: any = {};

    if (status) {
      matchStage.status = status;
    }

    if (portId) {
      matchStage._id = new ObjectId(portId);
    }

    const pipeline = [
      ...(Object.keys(matchStage).length > 0 ? [{ $match: matchStage }] : []),
      {
        $lookup: {
          from: 'loadcells',
          localField: '_id',
          foreignField: 'portId',
          as: 'loadcells',
        },
      },
      {
        $match: {
          loadcells: { $ne: [], $exists: true },
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          path: 1,
          status: 1,
          createdAt: 1,
          updatedAt: 1,
          loadcells: 1,
        },
      },
      { $sort: { name: 1, path: 1 } },
      {
        $facet: {
          data: [{ $skip: (page - 1) * limit }, { $limit: limit }],
          count: [{ $count: 'total' }],
        },
      },
    ];

    const result = await this._portRepository.aggregate(pipeline);

    const data = result[0]?.data || [];
    const total = result[0]?.count[0]?.total || 0;

    const entities = data.map((item: any) => this._portRepository.map(item));

    return new PaginatedResult(
      entities,
      new PaginationMeta({
        limit,
        page,
        total,
      }),
    );
  }

  public async updatePortName(id: string, name: string): Promise<boolean> {
    const result = await this._portRepository.nativeUpdate({ _id: new ObjectId(id) }, { name });
    return result > 0;
  }

  public async resetPortNames(): Promise<boolean> {
    const result = await this._portRepository.getCollection().updateMany({}, [
      {
        $set: {
          name: '$path',
        },
      },
    ]);
    return result.matchedCount > 0;
  }
}
