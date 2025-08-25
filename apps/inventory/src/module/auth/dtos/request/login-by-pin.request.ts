import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginByPinRequest {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @Expose()
  signature: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  pin: string;
}
