import { BinEntity } from '@entity/bin.entity';
import { Properties } from '@framework/types';

import { CabinetEntity } from './cabinet.entity';

export class CabinetBinEntity extends CabinetEntity {
  bins: BinEntity[];

  constructor(props: Properties<CabinetBinEntity>) {
    const { bins, ...p } = props;
    super(p);
    this.bins = bins;
  }
}
