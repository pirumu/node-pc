import { BaseEntity, Properties } from './base.entity';

export class CabinetEntity extends BaseEntity {
  name: string;
  code: string | null;
  numberOfRows?: number;
  totalBins?: number;
  type?: string;

  constructor(props: Properties<CabinetEntity>) {
    super();
    Object.assign(this, props);
  }
}
