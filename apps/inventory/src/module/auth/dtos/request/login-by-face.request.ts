import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginByFaceRequest {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  data: string;
}
