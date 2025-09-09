export type UserDto = {
  id: string;
  username: string;
  fullname: string;
  firstName: string;
  lastName: string;
  email: string;
  address: string;
  phone: string;
  avatar: string | null;
  roleKey: string;
  status: string;
  siteIds: Array<{ $oid: string } | string>;
  permissions: string[];
  createdBy: string;
  updatedBy: string;
  updatedAt: string;
  createdAt: string;
  remember_token: string;

  pin: string;
  cardId: string;
  employeeId: string;
  departmentId: string;
  emailVerifiedAt: string | null;
};
