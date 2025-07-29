import { isObject, isString } from '@nestjs/common/utils/shared.utils';

export class ValidatorException extends Error {
  constructor(private readonly _response: string | Record<string, unknown> | Record<string, unknown>[]) {
    super();
    ValidatorException.createBody(this._response);
    this.initMessage();
    this.initName();
  }

  public initMessage(): void {
    if (isString(this._response)) {
      this.message = this._response;
    } else if (isObject(this._response) && isString((this._response as Record<string, unknown>).message)) {
      this.message = <string>(this._response as Record<string, unknown>).message;
    }
  }

  public initName(): void {
    this.name = this.constructor.name;
  }

  public getResponse(): string | object {
    return this._response;
  }

  public static createBody(objectError: object | string | Record<string, unknown>[]): object {
    return { message: objectError };
  }
}
