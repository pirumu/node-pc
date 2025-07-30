import { PortMRepository } from '@dals/mongo/repositories';
import { PortEntity } from '@entity';
import { PortMapper } from '@mapper';
import { Injectable } from '@nestjs/common';

import { IPortRepository } from '../port.repository';

@Injectable()
export class PortImplRepository implements IPortRepository {
  constructor(private readonly _repository: PortMRepository) {}

  public async findAll(status?: string): Promise<PortEntity[]> {
    const results = await this._repository.findMany(
      status
        ? {
            status: status,
          }
        : {},
    );
    return PortMapper.toEntities(results);
  }

  public async update(id: string, data: PortEntity): Promise<boolean> {
    const document = PortMapper.toModel(data);
    const result = await this._repository.updateFirst({ _id: id }, document, {});
    return result.modifiedCount > 0;
  }

  public async setDefaultName(entities: PortEntity[]): Promise<boolean> {
    const operations = entities.map((entity) => ({
      updateOne: {
        filter: {
          _id: entity.id,
        },
        update: {
          name: entity.path,
        },
      },
    }));

    const result = await this._repository.bulkWrite(operations);

    return result.modifiedCount === entities.length;
  }
}
