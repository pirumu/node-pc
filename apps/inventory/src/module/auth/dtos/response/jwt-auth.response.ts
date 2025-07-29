import { Properties } from '@framework/types';
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class JwtAuthResponse {
  @ApiProperty({ name: 'access_token' })
  @Expose({ name: 'access_token' }) // backward compatible
  accessToken: string;

  @ApiProperty({ name: 'username' })
  @Expose({ name: 'username' }) // backward compatible
  loginId: string;

  constructor(props: Properties<JwtAuthResponse>) {
    Object.assign(this, props);
  }
}
