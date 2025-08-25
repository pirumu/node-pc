import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { IsOptional } from 'class-validator';

export class SiteReferenceDto {
  @ApiProperty({
    description: 'Site ID',
    example: '507f1f77bcf86cd799439011',
  })
  @Expose()
  @Type(() => String)
  id: string;

  @ApiProperty({
    description: 'Site name',
    example: 'Main Site',
  })
  @Expose()
  @Type(() => String)
  name: string;

  @ApiPropertyOptional({
    description: 'Site code',
    example: 'MS001',
  })
  @Expose()
  @Type(() => String)
  code?: string;
}

export class GetClusterResponse {
  @ApiProperty({
    description: 'Cluster ID',
    example: '507f1f77bcf86cd799439011',
  })
  @Expose()
  @Type(() => String)
  id: string;

  @ApiProperty({
    description: 'Site information',
    type: SiteReferenceDto,
  })
  @Expose()
  @Type(() => SiteReferenceDto)
  site: SiteReferenceDto;

  @ApiProperty({
    description: 'Cluster name',
    example: 'Production Cluster A',
  })
  @Expose()
  @Type(() => String)
  name: string;

  @ApiPropertyOptional({
    description: 'Cluster code',
    example: 'PCA001',
  })
  @Expose()
  @Type(() => String)
  @IsOptional()
  code?: string;

  @ApiProperty({
    description: 'RFID enabled status',
    example: false,
  })
  @Expose()
  @Type(() => Boolean)
  isRFID: boolean;

  @ApiProperty({
    description: 'Virtual cluster status',
    example: false,
  })
  @Expose()
  @Type(() => Boolean)
  isVirtual: boolean;

  @ApiProperty({
    description: 'Online status',
    example: true,
  })
  @Expose()
  @Type(() => Boolean)
  isOnline: boolean;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2024-01-15T10:30:00Z',
  })
  @Expose()
  createdAt: string;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2024-01-20T15:45:00Z',
  })
  @Expose()
  updatedAt: string;
}
