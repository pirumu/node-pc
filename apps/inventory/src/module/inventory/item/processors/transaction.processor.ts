import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

import { QUEUE_NAMES } from '../item.constants';

@Processor(QUEUE_NAMES.PROCESS_ITEM)
export class RequestItemProcessor extends WorkerHost {
  public async process(job: Job): Promise<any> {
    throw new Error('Method not implemented.');
  }
}
