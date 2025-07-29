import { Stream } from 'stream';

export class KeyboardBase extends Stream {
  public device: any;

  constructor(device: any, options?: any) {
    super();

    this.device = new device(options);

    this.device.on('error', (error: any) => this.emit('error', error));
    this.device.on('end', () => this.emit('end'));
    this.device.on('close', () => this.emit('close'));
  }

  public close(): void {
    this.device.close();
    this.emit('close');
  }
}
