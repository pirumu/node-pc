import { JobCardEntity } from '@entity';
import { BaseController } from '@framework/controller';
import { Body, Controller, Get, Inject, Injectable, Post } from '@nestjs/common';

import { WsGateway } from '../../ws';

import { JobCardResponse } from './dtos/response';
import { IJobCardRepository, JOB_CARD_REPOSITORY_TOKEN } from './repositories';

@Controller('job-cards')
export class JobCardController extends BaseController {
  constructor(
    private readonly _wsGateway: WsGateway,
    @Inject(JOB_CARD_REPOSITORY_TOKEN) private readonly _repository: IJobCardRepository,
  ) {
    super();
  }

  public async getJobCardsByIds(ids: string[]): Promise<JobCardEntity[]> {
    return this._repository.findByIds(ids);
  }
  @Post('verify')
  public async verifyJobCard(@Body() data: { card_num: string }): Promise<any> {
    const result = (await this._repository.findByCardNumber(data.card_num)) as JobCardEntity;
    return { wo_id: result.id, wo: result.wo };
  }

  @Get('list')
  public async getJobCards(): Promise<any> {
    const results = await this._repository.findAll();
    return { rows: results.map((e) => this.toDto(JobCardResponse, e)), count: results.length };
  }

  @Get('mock-send-job-card')
  public async mockSendJobCard(): Promise<any> {
    const jobCard = await this._repository.findByCardNumber('123456');
    if (jobCard) {
      const data = {
        success: true,
        data: {
          wo_id: jobCard.id,
          wo: jobCard.wo,
        },
      };
      this._wsGateway.sendMessage('scan-job-card' as any, data);
    }
  }

  @Get('mock-job-card-scan')
  public async mockJobCardScan(): Promise<any> {
    const jobCard = await this._repository.findByCardNumber('123456');
    if (jobCard) {
      const data = {
        success: true,
        data: {
          cardNum: jobCard.cardNumber,
        },
      };
      this._wsGateway.sendMessage('scan-card' as any, data);
    }
  }
}
