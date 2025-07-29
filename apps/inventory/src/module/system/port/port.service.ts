import { PortEntity } from '@entity';
import { Inject, Injectable } from '@nestjs/common';

import { GetPortsRequest } from './dtos/request';
import { PORT_REPOSITORY_TOKEN, IPortRepository } from './repositories';

@Injectable()
export class PortService {
  constructor(@Inject(PORT_REPOSITORY_TOKEN) private readonly _repository: IPortRepository) {}

  public async getPorts(dto: GetPortsRequest): Promise<PortEntity[]> {
    return this._repository.findAll(dto.status);
  }

  public async updatePortName(id: string, name: string): Promise<boolean> {
    return this._repository.update(id, { name });
  }

  public async resetPortNames(): Promise<boolean> {
    const ports = await this._repository.findAll();
    return this._repository.setDefaultName(ports);
  }
}
