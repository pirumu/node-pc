import { FingerprintVerifyCommand } from '@common/commands/auth';
import { IContextualResponse } from '@fingerprint-scanner';
import { TracingID, Transport } from '@framework/decorators';
import { Controller, Logger } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';

import { FingerprintService } from './fingerprint-scan.service';

@Controller()
export class FingerprintScanController {
  private readonly _logger = new Logger(FingerprintScanController.name);
  constructor(private readonly _fingerprintScanService: FingerprintService) {}

  @MessagePattern(FingerprintVerifyCommand.CHANNEL)
  public async verify(@TracingID({ transport: Transport.TCP }) tracingId: string): Promise<IContextualResponse> {
    this._logger.log(`Verifying fingerprint data with tracing id: ${tracingId}`);
    return this._fingerprintScanService.verify();
  }
}
