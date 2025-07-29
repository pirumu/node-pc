import { pbkdf2, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const pbkdf2Async = promisify(pbkdf2);

export class Pbkdf2 {
  private readonly _config = {
    saltLength: 16, // Smaller salt for IoT (vs 32 for web)
    keyLength: 32, // 256-bit output
    iterations: 10000, // Lower iterations for IoT (vs 100k for web)
    algorithm: 'sha256', // Fast and secure
  };

  constructor(options?: { saltLength: number; keyLength: number; iterations: number; algorithm: string }) {
    this._config = {
      ...this._config,
      ...options,
    };
  }

  public async hash(password: string): Promise<string> {
    const salt = randomBytes(this._config.saltLength);
    const key = await pbkdf2Async(password, salt, this._config.iterations, this._config.keyLength, this._config.algorithm);

    return `${this._config.iterations}.${salt.toString('hex')}.${key.toString('hex')}`;
  }

  public async compare(password: string, hash: string): Promise<boolean> {
    try {
      const [iterationsStr, saltHex, keyHex] = hash.split('.');

      const iterations = parseInt(iterationsStr);
      const salt = Buffer.from(saltHex, 'hex');
      const storedKey = Buffer.from(keyHex, 'hex');

      const key = await pbkdf2Async(password, salt, iterations, this._config.keyLength, this._config.algorithm);

      return timingSafeEqual(storedKey, key);
    } catch {
      return false;
    }
  }
}
