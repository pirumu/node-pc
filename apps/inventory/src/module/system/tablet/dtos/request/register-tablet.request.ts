import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsBoolean, IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RegisterTabletRequest {
  @ApiProperty({
    name: 'clientId',
    description:
      'The device unique ID. On Android it is currently identical to getAndroidId() in this module. On iOS it uses the DeviceUID uid identifier. On Windows it uses Windows.Security.ExchangeActiveSyncProvisioning.EasClientDeviceInformation.id.',
  })
  @Expose()
  @IsNotEmpty()
  @IsString()
  public clientId: string;

  @ApiProperty()
  @Expose()
  @IsMongoId()
  @IsString()
  siteId: string;

  @ApiProperty()
  @Expose()
  @IsMongoId()
  @IsString()
  accessKey: string;

  @ApiProperty()
  @Expose()
  @IsNotEmpty()
  @IsMongoId()
  clusterId: string;

  @ApiProperty({ required: false, default: false })
  @Expose()
  @IsOptional()
  @IsBoolean()
  isMfaEnabled: boolean;
}
