import { Role } from '@entity';

export class AuthClaimsDto {
  id: string;
  loginId: string;
  userCloudId: string;
  employeeId: number;
  cardNumber: number;
  role: Role;
  genealogy: string;

  /**
   * @deprecated
   * backward compatible
   */
  userLogin: string;

  /**
   * @deprecated
   * backward compatible
   */
  userRole: string;

  /**
   * @deprecated
   * backward compatible
   */
  treeCode: string;

  /**
   * @deprecated
   * backward compatible
   */
  user_cloud_id: string;

  /**
   * @deprecated
   * backward compatible
   */
  client_id: string;
}
