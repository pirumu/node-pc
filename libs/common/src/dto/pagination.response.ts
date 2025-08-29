import { Properties } from '@framework/types';
import { ApiProperty } from '@nestjs/swagger';

export class PaginationMeta {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 100 })
  total: number;

  @ApiProperty({ example: 30 })
  limit: number;

  @ApiProperty({ example: 10 })
  totalPages?: number;

  constructor(props: Properties<PaginationMeta>) {
    Object.assign(this, props);
    this.totalPages = Math.ceil(this.total / this.limit);
  }
}

export class PaginationResponse<T> {
  @ApiProperty({ isArray: true, required: true, default: [] })
  data: T[];

  @ApiProperty({ type: PaginationMeta })
  meta: PaginationMeta;

  constructor(data: T[], metadata: PaginationMeta) {
    this.data = data;
    this.meta = {
      ...metadata,
      totalPages: Math.ceil(metadata.total / metadata.limit),
    };
  }
}
