import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { ProcessItemService } from './process-item.service';

@Processor('process-item')
export class ProcessItemProcessor extends WorkerHost {
  private readonly _logger = new Logger(ProcessItemProcessor.name);

  constructor(private readonly _processItemService: ProcessItemService) {
    super();
  }

  public async process(job: Job): Promise<any> {
    this._logger.log(`Starting job ${job.id} - type: ${job.data.type}, items: ${job.data.data.length}`);

    try {
      await this._processItemService.processItems(job.id, job.data);
      this._logger.log(`Job ${job.id} completed successfully`);
      return { success: true };
    } catch (error) {
      this._logger.error(`Job ${job.id} failed:`, error);
      throw error;
    }
  }
}
