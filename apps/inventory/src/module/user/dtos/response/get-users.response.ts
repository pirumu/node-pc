import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Transform, Type } from 'class-transformer';

export class GetUsersResponse {
  @ApiProperty()
  @Expose()
  id: string;

  @ApiProperty()
  @Expose()
  username: string;

  @ApiProperty()
  @Expose()
  firstName: string;

  @ApiProperty()
  @Expose()
  lastName: string;

  @ApiProperty()
  @Expose()
  phone: string;

  @ApiProperty()
  @Expose()
  address: string;

  @ApiProperty()
  @Expose()
  avatar: string;

  @ApiProperty()
  @Expose()
  email: string;

  @ApiProperty()
  @Expose()
  emailVerifiedAt?: Date;

  @ApiProperty()
  @Exclude()
  cardId: string;

  @ApiProperty()
  @Expose()
  employeeId: string;

  @ApiProperty()
  @Expose()
  status?: string;

  @ApiProperty({ type: [String] })
  @Expose()
  @Type(() => Array)
  permissions: string[];

  @ApiProperty()
  @Expose()
  roleKey: string;

  @ApiProperty()
  @Expose()
  departmentId?: string;

  @ApiProperty({ type: [String] })
  @Expose()
  siteIds: string[];

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  updatedAt: Date;

  @ApiProperty()
  @Expose()
  createdBy?: string;

  @ApiProperty()
  @Expose()
  updatedBy?: string;

  @ApiProperty()
  @Expose()
  @Transform(({ obj }) => `${obj.firstName} ${obj.lastName}`)
  fullname: string;
}
