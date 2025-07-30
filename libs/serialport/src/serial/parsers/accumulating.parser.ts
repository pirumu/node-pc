import { Transform } from 'stream';

export class AccumulatingParser extends Transform {
  private _buffer: Buffer = Buffer.alloc(0);
  private readonly _maxSize: number;
  private readonly _delimiter?: Buffer;

  constructor(options: { maxSize?: number; delimiter?: string } = {}) {
    super();
    this._maxSize = options.maxSize || 1024 * 1024;
    this._delimiter = options.delimiter ? Buffer.from(options.delimiter) : undefined;
  }

  public _transform(chunk: Buffer, encoding: string, callback: () => void): void {
    this._buffer = Buffer.concat([this._buffer, chunk]);

    if (this._buffer.length >= this._maxSize) {
      this.push(this._buffer);
      this._buffer = Buffer.alloc(0);
    }

    if (this._delimiter) {
      const delimiterIndex = this._buffer.indexOf(this._delimiter);
      if (delimiterIndex !== -1) {
        const message = this._buffer.slice(0, delimiterIndex);
        this.push(message);
        this._buffer = this._buffer.slice(delimiterIndex + this._delimiter.length);
      }
    }

    callback();
  }

  public _flush(callback: () => void): void {
    if (this._buffer.length > 0) {
      this.push(this._buffer);
    }
    callback();
  }
}
