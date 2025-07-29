import { Stream } from 'stream';

import { HID } from 'node-hid';

export type HidOptions = {
  path?: string;
  vendorId?: number;
  productId?: number;
};

export class HidStream extends Stream {
  public readonly options: HidOptions;
  public readonly path?: string;
  public readonly vendorId?: number;
  public readonly productId?: number;

  private _device: HID;

  constructor(opts?: HidOptions) {
    super();

    const options = opts || {};
    verify(options);

    this.options = options;
    this.path = options.path;
    this.vendorId = options.vendorId;
    this.productId = options.productId;

    this._device = newHidDevice(options);

    this._device.on('data', (data: Buffer) => this.emit('data', data));
    this._device.on('error', (error: Error) => this.emit('error', error));
    this._device.on('end', () => this.emit('end'));
  }

  public close(): void {
    this._device.close();
    this.emit('close');
  }
}

function verify(options: HidOptions): void {
  const isUndefined = (v: unknown): boolean => typeof v === 'undefined';

  if ([options.path, options.vendorId, options.productId].every(isUndefined)) {
    throw new Error('No HID path or vendorId/productId specified');
  }

  if (isUndefined(options.path)) {
    if (isUndefined(options.productId)) {
      throw new Error('No HID productId specified');
    }

    if (isUndefined(options.vendorId)) {
      throw new Error('No HID vendorId specified');
    }
  }
}

function newHidDevice(options: HidOptions): HID {
  if (options.path) {
    return new HID(options.path);
  }

  return new HID(options.vendorId!, options.productId!);
}
