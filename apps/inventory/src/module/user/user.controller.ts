import { AuthUser } from '@common/decorator';
import { AuthUserDto, PaginationResponse } from '@common/dto';
import { BaseController } from '@framework/controller';
import { ApiDocs, ControllerDocs } from '@framework/swagger';
import { Controller, Get, Query } from '@nestjs/common';

import { GetUsersRequest } from './dtos/request';
import { GetUsersResponse } from './dtos/response';
import { USER_ROUTES } from './user.constants';
import { UserService } from './user.service';

@ControllerDocs({
  tag: 'Users',
  securitySchema: 'bearer',
})
@Controller(USER_ROUTES.GROUP)
export class UserController extends BaseController {
  constructor(private readonly _userService: UserService) {
    super();
  }

  @ApiDocs({
    summary: 'Get user',
    paginatedResponseSchema: GetUsersResponse,
  })
  @Get(USER_ROUTES.ME)
  public async getUser(@AuthUser() user: AuthUserDto): Promise<GetUsersResponse> {
    const entity = await this._userService.findOne(user.id);
    return this.toDto<GetUsersResponse>(GetUsersResponse, entity.toPOJO());
  }

  @ApiDocs({
    summary: 'Get all users',
    paginatedResponseSchema: GetUsersResponse,
  })
  @Get(USER_ROUTES.GET_USERS)
  public async getUsers(@Query() query: GetUsersRequest): Promise<PaginationResponse<GetUsersResponse>> {
    const { rows, meta } = await this._userService.findAll(query.page || 1, query.limit || 10);
    const data = rows.map((row) => this.toDto<GetUsersResponse>(GetUsersResponse, row.toPOJO()));
    return new PaginationResponse(data, meta);
  }
}
