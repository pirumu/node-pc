import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, IsUrl, Min } from 'class-validator';

export class RegisterTabletRequestDto {
  @ApiProperty({ name: 'clusterId' })
  @Expose({ name: 'clusterId' })
  @IsInt()
  public clusterId: number;

  @ApiProperty({ name: 'username' })
  @Expose({ name: 'username' })
  @IsString()
  public username: string;

  @ApiProperty({ name: 'accessKey' })
  @Expose({ name: 'accessKey' })
  @IsString()
  @IsOptional()
  public accessKey?: string;

  @ApiProperty({ name: 'password' })
  @Expose({ name: 'password' })
  @IsString()
  public password: string;

  @ApiProperty({ name: 'interval_sync_time' })
  @Expose({ name: 'interval_sync_time' })
  @IsInt()
  @Min(1)
  public intervalSyncTime: number;

  @ApiProperty({ name: 'cloud_url' })
  @Expose({ name: 'cloud_url' })
  @IsUrl()
  public cloudUrl: string;

  @ApiProperty({ name: 'compensation_time' })
  @Expose({ name: 'compensation_time' })
  @IsInt()
  public compensationTime: number;

  @ApiProperty({ name: 'torque_wrench_type_id' })
  @Expose({ name: 'torque_wrench_type_id' })
  @IsInt()
  public torqueWrenchTypeId: number;

  @ApiProperty({ name: 'is_2fa' })
  @Expose({ name: 'is_2fa' })
  @IsBoolean()
  public is2fa: boolean;
}
