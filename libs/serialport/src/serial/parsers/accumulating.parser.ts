/* eslint-disable */
import { Transform } from 'stream';

class AccumulatingParser extends Transform {
  private buffer: Buffer = Buffer.alloc(0);
  private maxSize: number;
  private delimiter?: Buffer;

  constructor(options: { maxSize?: number; delimiter?: string } = {}) {
    super({ readableObjectMode: true }); // Important for emitting strings
    this.maxSize = options.maxSize || 1024 * 1024;
    this.delimiter = options.delimiter ? Buffer.from(options.delimiter) : undefined;
  }

  _transform(chunk: Buffer, encoding: string, callback: () => void) {
    this.buffer = Buffer.concat([this.buffer, chunk]);

    if (this.checkEmitCondition()) {
      this.emitData();
    }

    callback();
  }

  private checkEmitCondition(): boolean {
    if (this.buffer.length >= this.maxSize) {
      return true;
    }

    if (this.delimiter) {
      return this.buffer.indexOf(this.delimiter) !== -1;
    }

    return true;
  }

  private emitData() {
    if (this.delimiter) {
      let delimiterIndex;
      while ((delimiterIndex = this.buffer.indexOf(this.delimiter)) !== -1) {
        const message = this.buffer.slice(0, delimiterIndex);
        this.emit('data', message.toString()); // Emit as string
        this.buffer = this.buffer.slice(delimiterIndex + this.delimiter.length);
      }
    } else {
      this.emit('data', this.buffer.toString());
      if (this.buffer.length >= this.maxSize) {
        this.buffer = Buffer.alloc(0);
      }
    }
  }

  _flush(callback: () => void) {
    if (this.buffer.length > 0) {
      this.emit('data', this.buffer.toString());
    }
    callback();
  }
}
