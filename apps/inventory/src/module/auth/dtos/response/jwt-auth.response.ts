import { Properties } from '@framework/types';
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class JwtAuthResponse {
  @ApiProperty({ required: false })
  @Expose()
  @Type(() => String)
  accessToken?: string;

  @ApiProperty({ required: false })
  @Expose()
  @Type(() => String)
  username?: string;

  @ApiProperty({ required: false })
  @Expose()
  @Type(() => String)
  signature?: string;

  @ApiProperty({ required: false })
  @Expose()
  @Type(() => String)
  signatureExpireInMs?: number;

  @ApiProperty({ required: false })
  @Expose()
  @Type(() => String)
  expireIn?: string;

  constructor(props: Properties<JwtAuthResponse>) {
    Object.assign(this, props);
  }
}
