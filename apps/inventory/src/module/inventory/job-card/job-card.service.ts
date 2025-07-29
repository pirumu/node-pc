import { JobCardEntity } from '@entity';
import { Inject, Injectable } from '@nestjs/common';
import { IJobCardRepository, JOB_CARD_REPOSITORY_TOKEN } from './repositories';

@Injectable()
export class JobCardService {
  constructor(@Inject(JOB_CARD_REPOSITORY_TOKEN) private readonly _repository: IJobCardRepository) {}

  public async getJobCardsByIds(ids: string[]): Promise<JobCardEntity[]> {
    return this._repository.findAll(ids);
  }
}
