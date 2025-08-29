import { PaginationRequest } from '@common/dto';
import { ApiProperty } from '@nestjs/swagger';

export class GetCabinetsRequest extends PaginationRequest {
  @ApiProperty()
  siteId: string;
}
