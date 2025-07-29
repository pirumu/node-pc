import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsMongoId } from 'class-validator';

export class OpenAllBinRequest {
  @ApiProperty()
  @IsMongoId()
  @Type(() => String)
  cabinetId: string;
}
