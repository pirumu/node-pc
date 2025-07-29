import { BaseController } from '@framework/controller';
import { ApiDocs, ControllerDocs } from '@framework/swagger';
import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';

import { HEADER_KEYS } from '../../../common';

import { BIN_ROUTES } from './bin.constants';
import { BinService } from './bin.service';
import { ConfirmProcessRequest, OpenAllBinRequest } from './dtos/request';
import { GetBinsResponse, GetBinResponse } from './dtos/response';

@ControllerDocs({
  tag: '[INVENTORY] Bin',
  securitySchema: 'header',
  securityKey: HEADER_KEYS.DEVICE_KEY,
})
@Controller(BIN_ROUTES.GROUP)
export class BinController extends BaseController {
  constructor(private readonly _binService: BinService) {
    super();
  }

  @ApiDocs({
    responseSchema: [GetBinsResponse],
  })
  @Get(BIN_ROUTES.GET_BINS)
  public async getBins(): Promise<GetBinsResponse[]> {
    // const result = await this._binService.getBins();
    // return result.map((bin) => this.toDto<GetBinsResponse>(GetBinsResponse, bin));
    return [];
  }

  @ApiDocs({
    responseSchema: GetBinResponse,
  })
  @Get(BIN_ROUTES.GET_BIN_BY_ID)
  public async getBinById(@Param('id') id: string): Promise<GetBinResponse | null> {
    return null;
    // const result = await this._binService.getBinById(id);
    // if (!result) {
    //   return null;
    // }
    // return this.toDto<GetBinResponse>(GetBinResponse, result);
  }

  @ApiDocs({
    responseSchema: Boolean,
  })
  @Post(BIN_ROUTES.OPEN_BIN)
  public async open(@Param('id') id: string): Promise<boolean> {
    return this._binService.open(id);
  }

  @ApiDocs({
    responseSchema: Boolean,
  })
  @Post(BIN_ROUTES.OPEN_ALL)
  public async openAll(@Body() body: OpenAllBinRequest): Promise<boolean> {
    return this._binService.openAll(body);
  }

  @ApiDocs({
    responseSchema: Boolean,
  })
  @Put(BIN_ROUTES.ACTIVATE_BIN)
  public async active(@Param('id') id: string): Promise<boolean> {
    return this._binService.activate(id);
  }

  @ApiDocs({
    responseSchema: Boolean,
  })
  @Put(BIN_ROUTES.DEACTIVATE_BIN)
  public async deactivate(@Param('id') id: string): Promise<boolean> {
    return this._binService.deactivate(id);
  }

  @ApiDocs({
    responseSchema: Boolean,
  })
  @Post('confirm')
  public async confirm(@Body() dto: ConfirmProcessRequest): Promise<boolean> {
    return this._binService.confirm(dto.isNextRequestItem);
  }

  @ApiDocs({
    responseSchema: null, // Define response schema as needed
  })
  @Post('replace-item/:id')
  public async replaceItem(@Param('id') id: string) {
    // return this._binService.replaceItem(id);
  }

  // @ApiDocs({
  //   responseSchema: null, // Define response schema as needed
  // })
  // @Post('remove-item/:id')
  // public async removeItem(@Param('id') id: string) {
  //   return this._binService.removeItem(id);
  // }
}
