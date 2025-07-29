import split from 'split';

import { HidOptions } from './hidstream';
import { KeyboardBase } from './keyboard-base';
import { KeyboardCharacters } from './keyboard-characters';

export class KeyboardLines extends KeyboardBase {
  constructor(options: HidOptions) {
    super(KeyboardCharacters, options);

    this.device.pipe(split()).on('data', (data: string) => {
      this.emit('data', data);
    });
  }
}
