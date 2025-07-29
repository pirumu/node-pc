export class BaseEntity {
  id: string;
  createdAt?: string;
  updatedAt?: string;
}

export type PropertyKeys<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? never : K;
}[keyof T];

export type Properties<T> = Pick<T, PropertyKeys<T>>;
