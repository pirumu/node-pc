import { Controller, Post, Query } from '@nestjs/common';

import { GetUsersDto } from './dtos/request';
import { GetUsersResponse } from './dtos/response';
import { UserService } from './user.service';
import { USER_ROUTES } from './user.constants';
import { ApiDocs, ControllerDocs } from '@framework/swagger';

@ControllerDocs({
  tag: 'User',
  securitySchema: 'bearer',
})
@Controller(USER_ROUTES.GROUP)
export class UserController {
  constructor(private readonly _userService: UserService) {}

  @ApiDocs({
    responseSchema: GetUsersResponse,
  })
  @Post(USER_ROUTES.GET_USERS)
  public async getUsers(@Query() queries: GetUsersDto): Promise<GetUsersResponse> {
    const result = await this._userService.findAll(queries);
    return GetUsersResponse.toLegacyResponse(result.total, result.entities);
  }
}
