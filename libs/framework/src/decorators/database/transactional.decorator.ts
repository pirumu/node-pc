/** biome-ignore-all lint/suspicious/noExplicitAny: true */
import { RuntimeException } from '@nestjs/core/errors/exceptions';
import { InjectConnection } from '@nestjs/mongoose';
import { ClientSession, Connection } from 'mongoose';

export function Transactional(): MethodDecorator {
  const Injector = InjectConnection();
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    Injector(target, '_connection');
    descriptor.value = async function (...args: any[]): Promise<any> {
      if (!this._connection) {
        throw new RuntimeException('Cannot resolve mongo connection');
      }
      const session: ClientSession = await (this._connection as Connection).startSession();
      try {
        session.startTransaction();
        const result = await originalMethod.apply(this, args);
        await session.commitTransaction();
        return result;
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        await session.endSession();
      }
    };

    return descriptor;
  };
}
