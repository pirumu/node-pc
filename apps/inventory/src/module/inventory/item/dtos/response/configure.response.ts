import { ApiProperty } from '@nestjs/swagger';

export class GetConfigureResponse {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;
}
