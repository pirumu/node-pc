import { Provider } from '@nestjs/common';

import { UserController } from './user.controller';
import { USER_REPOSITORY_TOKEN } from './repositories';
import { UserImplRepository } from './repositories/impls';
import { UserService } from './user.service';
import { UserPublisherService } from './user-publisher.service';

export const CONTROLLERS = [UserController];
export const SERVICES_PROVIDERS = [UserService, UserPublisherService];
export const SERVICES_EXPORTS = [UserService];

export const REPOSITORY_PROVIDERS: Provider[] = [
  {
    provide: USER_REPOSITORY_TOKEN,
    useClass: UserImplRepository,
  },
];
