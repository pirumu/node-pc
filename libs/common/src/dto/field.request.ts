import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export function FieldRequestFactory(fields: string) {
  class FieldRequest {
    @ApiPropertyOptional({
      example: fields,
    })
    @IsString()
    @IsOptional()
    fields?: string;
  }
  return FieldRequest;
}
