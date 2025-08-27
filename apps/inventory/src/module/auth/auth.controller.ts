import { CLIENT_ID_KEY } from '@common/constants';
import { PaginationResponse } from '@common/dto';
import { RefHelper } from '@dals/mongo/helpers';
import { BaseController } from '@framework/controller';
import { AppHttpException } from '@framework/exception';
import { ApiDocs, ApiSignatureSecurity, ControllerDocs } from '@framework/swagger';
import { Body, Controller, Headers, Param, Post, Query, UseGuards } from '@nestjs/common';

import { WsGateway } from '../ws';

import { AUTH_ROUTES } from './auth.constants';
import { LoginByPinRequest, GetFacialRecognitionRequest, LoginByFaceRequest, LoginRequest } from './dtos/request';
import { GetFacialRecognitionResponse, JwtAuthResponse } from './dtos/response';
// import { SignatureGuard } from './guards';
import { AuthService } from './services';

@ControllerDocs({
  tag: 'Authorization',
})
@Controller(AUTH_ROUTES.PATH)
export class AuthController extends BaseController {
  constructor(
    private readonly _authService: AuthService,
    private readonly _wsGateway: WsGateway,
  ) {
    super();
  }

  @ApiDocs({
    summary: '2FA authentication',
    responseSchema: JwtAuthResponse,
    body: LoginByPinRequest,
  })
  @ApiSignatureSecurity()
  // @UseGuards(SignatureGuard)
  @Post(AUTH_ROUTES.LOGIN_BY_PIN_PASS)
  public async loginByPin(@Headers(CLIENT_ID_KEY) clientId: string, @Body() payload: LoginByPinRequest): Promise<JwtAuthResponse> {
    return this._authService.loginByPin(clientId, payload);
  }

  // @ApiDocs({
  //   summary: 'Fingerprint authentication',
  //   responseSchema: JwtAuthResponse,
  //   body: LoginByPinRequest,
  // })
  // @ApiSignatureSecurity()
  // @UseGuards(SignatureGuard)
  // @Post(AUTH_ROUTES.LOGIN_BY_FINGERPRINT)
  // public async loginViaFingerprint(@TracingID({ transport: Transport.HTTP }) tracingId: string): Promise<Record<string, any>> {
  //   return this._fingerprintAuthService.authenticate(tracingId);
  // }

  @ApiDocs({
    summary: 'get facial recognitions data',
    paginatedResponseSchema: GetFacialRecognitionResponse,
  })
  @ApiSignatureSecurity()
  // @UseGuards(SignatureGuard)
  @Post(AUTH_ROUTES.FACIAL_RECOGNITION)
  public async getFacialRecognitions(
    @Query() query: GetFacialRecognitionRequest,
  ): Promise<PaginationResponse<GetFacialRecognitionResponse>> {
    const { rows, meta } = await this._authService.getFacialRecognitions(query.page || 1, query.limit || 100);
    const data = rows.map((row) => {
      const pojo = row.toPOJO();
      const user = RefHelper.getRequired(row.user, 'UserEntity');
      return this.toDto<GetFacialRecognitionResponse>(GetFacialRecognitionResponse, {
        userId: user.id,
        data: pojo.data,
        hik: pojo.hik,
      });
    });

    return new PaginationResponse<GetFacialRecognitionResponse>(data, meta);
  }

  @ApiDocs({
    summary: 'Face authentication',
    responseSchema: JwtAuthResponse,
    body: LoginByPinRequest,
  })
  @ApiSignatureSecurity()
  // @UseGuards(SignatureGuard)
  @Post(AUTH_ROUTES.LOGIN_BY_FACE)
  public async loginByFaceData(
    @Headers(CLIENT_ID_KEY) clientId: string,
    @Body()
    payload: LoginByFaceRequest,
  ): Promise<JwtAuthResponse> {
    return this._authService.loginByFaceData(clientId, payload);
  }

  @ApiDocs({
    summary: '[Test only] Login via login id and password',
    responseSchema: JwtAuthResponse,
    body: LoginRequest,
  })
  @Post(AUTH_ROUTES.LOGIN)
  public async login(@Body() payload: LoginRequest): Promise<JwtAuthResponse> {
    if (process.env.NODE_ENV === 'production') {
      throw AppHttpException.forbidden();
    }

    return this._authService.login(payload);
  }

  @ApiDocs({
    summary: '[Test only] Fake scan card login',
    responseSchema: JwtAuthResponse,
  })
  @Post(AUTH_ROUTES.SCAN_CARD)
  public async loginByCard(@Param('cardId') cardId: string): Promise<any> {
    if (process.env.NODE_ENV === 'production') {
      throw AppHttpException.forbidden();
    }
    try {
      const responses = await this._authService.loginByCard(cardId);

      responses.forEach((res) => {
        if (res[0] === 'none') {
          this._wsGateway.sendMessage('scan-employee' as any, { success: true, data: res[1] });
        } else {
          this._wsGateway.sendTo('scan-employee' as any, { success: true, data: res[1] }, [res[0]]);
        }
      });

      return { msg: 'emitted' };
    } catch (err) {
      this._wsGateway.sendMessage('scan-employee' as any, { success: false, data: null });

      throw err;
    }
  }
}
