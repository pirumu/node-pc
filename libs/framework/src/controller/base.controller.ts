import { ClassConstructor, plainToInstance } from 'class-transformer';

export class BaseController {
  public toDto<T>(ctor: ClassConstructor<T>, data: any): T {
    return plainToInstance(ctor, data, { excludeExtraneousValues: true }) as T;
  }
}
