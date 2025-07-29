import { Inject } from '@nestjs/common';

import { HTTP_CLIENT_SERVICE } from './http-client.constants';

export const InjectHttpClient = () => Inject(HTTP_CLIENT_SERVICE);
