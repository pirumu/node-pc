import { AuthUserDto } from '@common/dto';

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    interface Request {
      user?: AuthUserDto;
    }
  }
}
