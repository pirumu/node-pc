import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsBoolean, IsNumber, IsString, IsUrl } from 'class-validator';

export class RegisterDeviceDto {
  @ApiProperty()
  @IsNumber()
  clusterId: number;

  @ApiProperty()
  @IsString()
  username: string;

  @ApiProperty()
  @IsString()
  password: string;

  @ApiProperty({ name: 'interval_sync_time' })
  @IsNumber()
  @Expose({ name: 'interval_sync_time' })
  intervalSyncTime: number;

  @ApiProperty({ name: 'cloud_url' })
  @IsUrl()
  @Expose({ name: 'cloud_url' })
  cloudUrl: string;

  @ApiProperty({ name: 'master_host' })
  @IsUrl()
  @Expose({ name: 'master_host' })
  masterHost: string;

  @ApiProperty({ name: 'compensation_time' })
  @IsNumber()
  @Expose({ name: 'compensation_time' })
  compensationTime: number;

  @ApiProperty({ name: 'face_sync_time' })
  @IsNumber()
  @Expose({ name: 'face_sync_time' })
  face_sync_time: number;

  @ApiProperty({ name: 'torque_wrench_type_id' })
  @IsNumber()
  @Expose({ name: 'torque_wrench_type_id' })
  torqueWrenchTypeId: number;

  @ApiProperty({ name: 'is_2fa' })
  @IsBoolean()
  @Expose({ name: 'is_2fa' })
  is2fa: boolean;
}
