import { IsNotEmpty } from 'class-validator';

export class LoginByUserIdDto {
  @IsNotEmpty()
  public userId: string;
}
