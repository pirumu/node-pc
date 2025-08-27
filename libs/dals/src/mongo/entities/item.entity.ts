import { PartialProperties } from '@framework/types';
import { Entity, Property, ManyToOne, Ref, OneToMany, Collection } from '@mikro-orm/core';

import { AbstractEntity } from './abstract.entity';
import { ItemTypeEntity } from './item-type.entity';
// eslint-disable-next-line import/no-cycle
import { LoadcellEntity } from './loadcell.entity';
import { SiteEntity } from './site.entity';

@Entity({ collection: 'items' })
export class ItemEntity extends AbstractEntity {
  @Property()
  partNo!: string;

  @Property()
  materialNo!: string;

  @Property()
  name!: string;

  @Property({ default: '' })
  supplierEmail: string = '';

  @Property({ default: '' })
  itemAccount: string = '';

  @Property({ default: '' })
  criCode: string = '';

  @Property({ default: '' })
  uom: string = '';

  @Property({ default: '' })
  materialGroup: string = '';

  @Property({ default: false })
  hasBatchNumber: boolean = false;

  @Property({ default: false })
  hasSerialNumber: boolean = false;

  @Property({ default: false })
  hasMinChargeTime: boolean = false;

  @Property({ default: false })
  hasInspection: boolean = false;

  @Property({ default: false })
  hasExpiryDate: boolean = false;

  @Property({ default: false })
  hasHydrostaticTest: boolean = false;

  @Property({ default: false })
  hasRFID: boolean = false;

  @Property({ default: false })
  hasBarcode: boolean = false;

  @Property({ default: '' })
  description: string = '';

  @Property({ default: '' })
  itemImage: string = '';

  @Property({ default: 0.0 })
  unitCost: number = 0.0;

  @Property({ default: 0.0 })
  retailCost: number = 0.0;

  @ManyToOne(() => SiteEntity, {
    fieldName: 'siteId',
    ref: true,
  })
  site!: Ref<SiteEntity>;

  @ManyToOne(() => ItemTypeEntity, {
    fieldName: 'itemTypeId',
    ref: true,
  })
  itemType!: Ref<ItemTypeEntity>;

  @OneToMany(() => LoadcellEntity, (loadcell) => loadcell.item, {
    nullable: true,
    default: [],
    persist: false,
  })
  loadcells = new Collection<LoadcellEntity>(this);

  constructor(data?: PartialProperties<ItemEntity>) {
    super();
    if (data) {
      Object.assign(this, data);
    }
  }
}
