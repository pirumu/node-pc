import { BaseEntity, Properties } from './base.entity';

export class FingerprintEntity extends BaseEntity {
  userId: string;
  label: string;
  feature: string;
  objectId: string;
  isSync: boolean;

  constructor(props: Properties<FingerprintEntity>) {
    super();
    Object.assign(this, props);
  }
}

export class FingerprintData {
  data: string;

  constructor(props: Properties<FingerprintData>) {
    Object.assign(this, props);
  }
}
