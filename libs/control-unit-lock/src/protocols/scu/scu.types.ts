import { LOCK_STATUS } from '../protocol.constants';
import { BaseResponse } from '../protocol.interface';

export type ScuResponse = BaseResponse & {
  lockStatus: LOCK_STATUS;
};
