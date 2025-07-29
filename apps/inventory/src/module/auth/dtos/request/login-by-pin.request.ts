import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginByPinRequest {
  @ApiProperty({ name: 'username' })
  @IsNotEmpty()
  @IsString()
  @Expose({ name: 'username' })
  loginId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  pin: string;
}
