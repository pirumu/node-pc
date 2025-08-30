import { PORT_STATUS, PortEntity } from '@dals/mongo/entities';
import { EntityManager } from '@mikro-orm/mongodb';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class PortEventService {
  constructor(private readonly _em: EntityManager) {}

  public async register(portPaths: string[]): Promise<void> {
    try {
      const em = this._em.fork();

      const ports = portPaths.map(
        (path) =>
          new PortEntity({
            name: path,
            path: path,
            status: PORT_STATUS.LOADED,
          }),
      );
      await em.insertMany(PortEntity, ports);
    } catch (error) {
      Logger.warn('Can not register port', {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
    }
  }
}
