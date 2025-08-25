import { PaginationMeta } from './pagination.response';

export class PaginatedResult<T = any> {
  rows: T[];
  meta: PaginationMeta;

  constructor(rows: T[], meta: PaginationMeta) {
    this.rows = rows;
    this.meta = meta;
  }
}
