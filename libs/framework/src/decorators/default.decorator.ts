import { Transform } from 'class-transformer';

export function Default(defaultValue: any, nullable: boolean = false) {
  return Transform(({ value }) => {
    if (value === undefined) {
      return defaultValue;
    }
    if (value === null) {
      return nullable ? null : defaultValue;
    }
    return value;
  });
}
