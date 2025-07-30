import { Properties } from '@framework/types';
import { ApiProperty } from '@nestjs/swagger';

export class LegacyApiResponseDto<T = any> {
  @ApiProperty()
  data?: T;

  @ApiProperty()
  success: boolean;

  constructor(props: Properties<LegacyApiResponseDto<T>>) {
    Object.assign(this, props);
  }
}

// export type IBaseResponseServer =
//   | {
//       success: true;
//       data?: object | Array<any>;
//     }
//   | { success: false };
//
// export interface IBaseResponse<T> {
//   message?: string;
//
//   /** This field has been transform from server to client into standard */
//   result: T;
// }
//
// export interface IPagingServer<T> {
//   count: number;
//   rows: T[];
// }
