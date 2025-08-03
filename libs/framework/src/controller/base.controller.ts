import { ClassConstructor, instanceToPlain, plainToInstance } from 'class-transformer';

export class BaseController {
  public toDto<T>(ctor: ClassConstructor<T>, data: any): T {
    return instanceToPlain(plainToInstance(ctor, data)) as T;
  }
}
