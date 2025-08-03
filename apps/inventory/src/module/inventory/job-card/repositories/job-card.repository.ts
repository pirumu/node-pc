import { JobCardEntity } from '@entity';

export const JOB_CARD_REPOSITORY_TOKEN = Symbol('IJobCardRepository');

export interface IJobCardRepository {
  findByIds(ids: string[]): Promise<JobCardEntity[]>;
  findAll(): Promise<JobCardEntity[]>;
  findByCardNumber(cardNumber: string): Promise<JobCardEntity | null>;
}
