import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class GetDeviceResponse {
  @ApiProperty({ description: 'Unique identifier', example: '507f1f77bcf86cd799439011' })
  @Expose()
  id: string;

  @ApiProperty({ description: 'Name of the device', example: 'Sample device' })
  @Expose()
  name: string;

  @ApiProperty({ description: 'Description of the device', example: 'This is a sample device', required: false })
  @Expose()
  description?: string;

  @ApiProperty({ description: 'Creation timestamp', example: '2024-01-01T00:00:00.000Z' })
  @Expose()
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp', example: '2024-01-01T00:00:00.000Z' })
  @Expose()
  updatedAt: Date;

  // TODO: Add more properties as needed
}
