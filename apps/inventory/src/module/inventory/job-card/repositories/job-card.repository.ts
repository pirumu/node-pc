import { JobCardEntity } from '@entity';

export const JOB_CARD_REPOSITORY_TOKEN = Symbol('IJobCardRepository');

export interface IJobCardRepository {
  findAll(ids: string[]): Promise<JobCardEntity[]>;
}
