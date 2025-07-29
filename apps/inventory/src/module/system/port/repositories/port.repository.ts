import { PortEntity } from '@entity';

export const PORT_REPOSITORY_TOKEN = Symbol('IPortRepository');

export interface IPortRepository {
  findAll(status?: string): Promise<PortEntity[]>;
  update(id: string, data: Partial<PortEntity>): Promise<boolean>;
  setDefaultName(data: PortEntity[]): Promise<boolean>;
}
