import { Ref } from '@mikro-orm/core';

import { AbstractEntity } from '../entities/abstract.entity';

export class RefHelper {
  public static getRequired<T extends AbstractEntity>(ref: Ref<T> | null | undefined, name: string): T & object {
    if (ref == null) {
      throw new Error(`Required reference ${name} is null or undefined`);
    }

    const entity = ref.unwrap();

    if (!entity) {
      throw new Error(`Required reference ${name} is not loaded`);
    }

    return entity as unknown as T & object;
  }

  public static get<T extends AbstractEntity>(ref: Ref<T> | null | undefined, name: string): (T & object) | null {
    if (!ref) {
      return null;
    }
    const entity = ref.unwrap();
    if (!entity) {
      return null;
    }
    return entity as unknown as T & object;
  }
}
