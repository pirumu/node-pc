import { EVENT_TYPE } from '@common/constants';
import { sleep } from '@framework/time/sleep';
import { Controller } from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';

import { WsGateway } from '../../../ws';

@Controller()
export class ProcessingItemEventController {
  constructor(private readonly _wsGateway: WsGateway) {}

  private _getChannel(txId: string) {
    return `tx_${txId}`;
  }

  @EventPattern(EVENT_TYPE.PROCESS.STEP_START)
  public onTxStarted(payload: {
    transactionId: string;
    type: string;
    label: string;
    items: Array<{
      itemId: string;
      name: string;
      requestQty: number;
    }>;
    keepTrackItems: Array<{
      itemId: string;
      name: string;
      currentQty: number;
    }>;
    instructions: string[];
  }): boolean {
    sleep(1000).then(() => {
      return this._wsGateway.sendTo(EVENT_TYPE.PROCESS.TRANSACTION_STARTED as any, payload, [
        this._getChannel(this._getChannel(payload.transactionId)),
      ]);
    });
    return true;
  }
  @EventPattern(EVENT_TYPE.PROCESS.BIN_FAILED)
  public onBinFailed(payload: { transactionId: string; binId: string }): boolean {
    return this._wsGateway.sendTo(EVENT_TYPE.PROCESS.BIN_FAILED as any, payload, [
      this._getChannel(this._getChannel(payload.transactionId)),
    ]);
  }

  // @EventPattern(EVENT_TYPE.PROCESS.INSTRUCTION)
  // public onInstruction(payload: { transactionId: string; instructions: string[] }): boolean {
  //   return this._wsGateway.sendTo(EVENT_TYPE.PROCESS.INSTRUCTION as any, payload, [this._getChannel(payload.transactionId)]);
  // }

  @EventPattern(EVENT_TYPE.LOADCELL.QUANTITY_CALCULATED)
  public onInstruction(payload: { itemId: string; hardwareId: number; changeInQuantity: number }): boolean {
    return this._wsGateway.sendTo(EVENT_TYPE.PROCESS.QTY_CHANGED as any, payload, [payload.itemId]);
  }

  // @EventPattern(EVENT_TYPE.PROCESS.QTY_CHANGED)
  // public onQtyChange(payload: { transactionId: string; itemName: string; itemId: string; message: string }): boolean {
  //   return this._wsGateway.sendTo(EVENT_TYPE.PROCESS.QTY_CHANGED as any, payload, [this._getChannel(payload.transactionId)]);
  // }

  @EventPattern(EVENT_TYPE.PROCESS.STEP_WARNING)
  public onWarning(payload: { transactionId: string; message: string }): boolean {
    return this._wsGateway.sendTo(EVENT_TYPE.PROCESS.STEP_WARNING as any, payload, [this._getChannel(payload.transactionId)]);
  }

  @EventPattern(EVENT_TYPE.PROCESS.STEP_ERROR)
  public onError(payload: { transactionId: string; stepId: string; errors: string[] }): boolean {
    return this._wsGateway.sendTo(EVENT_TYPE.PROCESS.STEP_ERROR as any, payload, [this._getChannel(payload.transactionId)]);
  }

  @EventPattern(EVENT_TYPE.PROCESS.TRANSACTION_COMPLETED)
  public onComplete(payload: { transactionId: string }): boolean {
    return this._wsGateway.sendTo(EVENT_TYPE.PROCESS.STEP_ERROR as any, payload, [this._getChannel(payload.transactionId)]);
  }
}
