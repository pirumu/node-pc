import { Provider } from '@nestjs/common';

import { UserController } from './user.controller';
import { UserService } from './user.service';

export const CONTROLLERS = [UserController];
export const SERVICES_PROVIDERS = [UserService];
export const SERVICES_EXPORTS = [UserService];

export const REPOSITORY_PROVIDERS: Provider[] = [];
