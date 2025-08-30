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
    populate?: boolean,
  ): Promise<PaginatedResult<PortEntity>> {
    const { status, portId } = filter;

    const where: FilterQuery<PortEntity> = {};

    if (status) {
      where.status = status;
    }

    if (portId) {
      where.port._id = new ObjectId(portId);
    }
    const options: FindOptions<PortEntity, keyof PortEntity> = {
      limit: limit,
      offset: (page - 1) * limit,
      populate: populate ? ['loadcells'] : [],
      orderBy: { name: 'ASC', path: 'ASC' },
    };
    const [rows, count] = await this._portRepository.findAndCount(where, options);
    return new PaginatedResult(
      rows,
      new PaginationMeta({
        limit,
        page,
        total: count,
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
