import { LOCK_STATUS } from '../protocol.constants';
import { BaseResponse } from '../protocol.interface';

export type CuResponse = BaseResponse & {
  lockStatuses?: { [lockId: number]: LOCK_STATUS };
};
