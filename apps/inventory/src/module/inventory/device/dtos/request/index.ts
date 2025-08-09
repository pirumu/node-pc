import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';
import { IsString, IsOptional, IsNotEmpty, IsMongoId, IsNumber, IsPositive, ValidateNested } from 'class-validator';

export class GetDevicesByAppRequest {
  @ApiPropertyOptional({
    description: 'Port ID to filter loadcells',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  @IsMongoId({ message: 'ID must be a valid MongoDB ObjectId' })
  portId?: string;
}

export class GetDeviceDetailRequest {
  @ApiProperty({
    description: 'Device ID',
  })
  @IsNotEmpty()
  // @IsNumber()
  // @IsMongoId({ message: 'ID must be a valid MongoDB ObjectId' })
  id: number;
}

export class GetDevicesByPortRequest {
  @ApiPropertyOptional({
    description: 'Port ID to get loadcells from specific port',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  portId?: string;
}

export class UnassignDevicesRequest {
  @ApiProperty({
    description: 'Device ID to unassign',
  })
  @IsNotEmpty()
  @IsString()
  @IsMongoId({ message: 'ID must be a valid MongoDB ObjectId' })
  id: string;
}

export class ActiveDevicesRequest {
  @ApiProperty({
    description: 'Device ID to activate',
  })
  @IsNotEmpty()
  @IsString()
  @IsMongoId({ message: 'ID must be a valid MongoDB ObjectId' })
  id: string;
}

export class AddLabelRequest {
  @ApiProperty({
    description: 'Device ID to add label to',
  })
  @IsNotEmpty()
  @IsString()
  @IsMongoId({ message: 'ID must be a valid MongoDB ObjectId' })
  id: string;

  @ApiProperty({
    description: 'Label to add to the loadcell',
    minLength: 1,
    maxLength: 100,
  })
  @IsNotEmpty()
  @IsString()
  @Transform(({ value }) => value?.trim())
  label: string;
}

export class RemoveLabelRequest {
  @ApiProperty({
    description: 'Device ID to remove label from',
  })
  @IsNotEmpty()
  @IsString()
  @IsMongoId({ message: 'ID must be a valid MongoDB ObjectId' })
  id: string;
}

export class DeviceDescriptionRequest {
  @ApiProperty({
    description: 'Device name',
  })
  @IsNotEmpty()
  @IsString()
  @Transform(({ value }) => value?.trim())
  name: string;
}

export class UpdateDeviceRequest {
  @ApiProperty({
    description: 'Device ID to update',
  })
  @IsNotEmpty()
  @IsString()
  @IsMongoId({ message: 'ID must be a valid MongoDB ObjectId' })
  id: string;

  @ApiProperty({
    description: 'Device ID',
    name: 'deviceId',
  })
  @IsNotEmpty()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  @Expose({
    name: 'deviceId', // backward compatible
  })
  deviceNumId: number;

  @ApiProperty({
    description: 'Calculated weight value',
  })
  @IsNotEmpty()
  @IsString()
  @Transform(({ value }) => value?.trim())
  calcWeight: string;

  @ApiProperty({
    description: 'Zero weight value',
  })
  @IsNotEmpty()
  @IsString()
  @Transform(({ value }) => value?.trim())
  zeroWeight: string;

  @ApiProperty({
    description: 'Device description object',
    type: DeviceDescriptionRequest,
  })
  @ValidateNested()
  @Type(() => DeviceDescriptionRequest)
  deviceDescription: DeviceDescriptionRequest;
}
