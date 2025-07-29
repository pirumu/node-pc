import { Properties } from '@framework/types';

import { EVENT_TYPE } from '../../../constants';
import { IAppEvent } from '../../../interfaces';

export class CardScanEvent implements IAppEvent {
  public readonly cardNumber: string;

  constructor(props: Properties<CardScanEvent>) {
    Object.assign(this, props);
  }

  public getChannel(): string {
    throw EVENT_TYPE.CARD_SCAN;
  }

  public getPayload(): { cardNumber: string } {
    return {
      cardNumber: this.cardNumber,
    };
  }
}
