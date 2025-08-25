import * as bcrypt from 'bcrypt';

export class BCrypto {
  private readonly _config = {
    saltOrRounds: 12,
  };

  constructor(options?: { saltOrRounds: number }) {
    this._config = {
      ...this._config,
      ...options,
    };
  }

  public async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this._config.saltOrRounds);
  }

  public async compare(password: string, hash: string): Promise<boolean> {
    try {
      return bcrypt.compare(password, hash);
    } catch {
      return false;
    }
  }
}
