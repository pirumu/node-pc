/* eslint-disable @typescript-eslint/naming-convention */
'use strict';

import { HidStream } from './hidstream';
import { KeyboardBase } from './keyboard-base';
import { keyboardParser } from './keyboard-parser';

interface KeyboardOptions {
  [key: string]: any;
}

export class Keyboard extends KeyboardBase {
  constructor(options: KeyboardOptions) {
    super(HidStream, options);

    this.device.on('data', (data: Buffer) => {
      this.emit('data', keyboardParser(data));
    });
  }
}
