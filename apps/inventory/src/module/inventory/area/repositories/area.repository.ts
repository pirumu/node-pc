import { AreaEntity } from '@entity';

export const AREA_REPOSITORY_TOKEN = Symbol('IAreaRepository');

export interface IAreaRepository {
  findAll(): Promise<AreaEntity[]>;
  findByIds(ids: string[]): Promise<AreaEntity[]>;
}
