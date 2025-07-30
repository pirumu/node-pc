import { Provider } from '@nestjs/common';

import { USER_REPOSITORY_TOKEN } from './repositories';
import { UserImplRepository } from './repositories/impls';
import { UserPublisherService } from './user-publisher.service';
import { UserController } from './user.controller';
import { UserService } from './user.service';

export const CONTROLLERS = [UserController];
export const SERVICES_PROVIDERS = [UserService, UserPublisherService];
export const SERVICES_EXPORTS = [UserService];

export const REPOSITORY_PROVIDERS: Provider[] = [
  {
    provide: USER_REPOSITORY_TOKEN,
    useClass: UserImplRepository,
  },
];
