import { Role } from '@entity';

export class AuthUserDto {
  id: string;
  loginId: string;
  userCloudId: string;
  employeeId: number;
  cardNumber: number;
  role: Role;
  genealogy: string;
}
