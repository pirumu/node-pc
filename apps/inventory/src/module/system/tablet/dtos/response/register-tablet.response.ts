import { Properties } from '@framework/types';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterTabletResponse {
  @ApiProperty()
  privateKey: string;

  constructor(props: Properties<RegisterTabletResponse>) {
    Object.assign(this, props);
  }
}
