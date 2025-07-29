import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginRequest {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  loginId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  password: string;
}
