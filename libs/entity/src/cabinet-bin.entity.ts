import { CabinetEntity } from './cabinet.entity';
import { BinEntity } from '@entity/bin.entity';
import { Properties } from '@framework/types';

export class CabinetBinEntity extends CabinetEntity {
  bins: BinEntity[];

  constructor(props: Properties<CabinetBinEntity>) {
    const { bins, ...p } = props;
    super(p);
    this.bins = bins;
  }
}
