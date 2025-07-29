import { JobCardMRepository } from '@dals/mongo/repositories';
import { JobCardEntity } from '@entity';
import { JobCardMapper } from '@mapper';
import { Injectable } from '@nestjs/common';

import { IJobCardRepository } from '../job-card.repository';

@Injectable()
export class JobCardImplRepository implements IJobCardRepository {
  constructor(private readonly _repository: JobCardMRepository) {}

  public async findAll(ids: string[]): Promise<JobCardEntity[]> {
    const results = await this._repository.findMany({ _id: { $in: ids } });
    return JobCardMapper.toEntities(results);
  }
}
