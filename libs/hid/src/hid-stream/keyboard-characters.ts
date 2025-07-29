import { Keyboard } from './keyboard';
import { KeyboardBase } from './keyboard-base';

export class KeyboardCharacters extends KeyboardBase {
  constructor(options: any) {
    super(Keyboard, options);

    this.device.on('data', (data: { charCodes: any[] }) => {
      this.emit('data', data.charCodes.join(''));
    });
  }
}
