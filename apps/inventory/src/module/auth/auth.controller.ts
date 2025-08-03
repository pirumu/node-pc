import { TracingID, Transport } from '@framework/decorators';
import { ApiDocs, ControllerDocs } from '@framework/swagger';
import { Body, Controller, Post } from '@nestjs/common';
import { instanceToPlain } from 'class-transformer';

import { WsGateway } from '../ws';

import { AUTH_ROUTES } from './auth.constants';
import { LoginByPinRequest } from './dtos';
import { LoginRequest } from './dtos/request';
import { JwtAuthResponse } from './dtos/response';
import { AuthService, FingerprintAuthService } from './services';

@ControllerDocs({
  tag: 'Authorization',
})
@Controller(AUTH_ROUTES.PATH)
export class AuthController {
  constructor(
    private readonly _authService: AuthService,
    private readonly _fingerprintAuthService: FingerprintAuthService,
    private readonly _wsGateway: WsGateway,
  ) {}

  @ApiDocs({
    summary: 'Login via login id and password',
    responseSchema: JwtAuthResponse,
    body: LoginRequest,
  })
  @Post(AUTH_ROUTES.LOGIN)
  public async login(@Body() payload: LoginRequest): Promise<JwtAuthResponse> {
    return this._authService.login(payload);
  }

  @ApiDocs({
    summary: '2FA authentication',
    responseSchema: JwtAuthResponse,
    body: LoginByPinRequest,
  })
  @Post(AUTH_ROUTES.LOGIN_BY_PIN_PASS)
  public async loginByPin(@Body() payload: LoginByPinRequest): Promise<Record<string, any>> {
    const result = await this._authService.loginByPin(payload);
    // Backward compatible
    return instanceToPlain(result);
  }

  @ApiDocs({
    summary: 'Fingerprint authentication',
    responseSchema: JwtAuthResponse,
    body: LoginByPinRequest,
  })
  @Post(AUTH_ROUTES.LOGIN_BY_FINGERPRINT)
  public async loginViaFingerprint(@TracingID({ transport: Transport.HTTP }) tracingId: string): Promise<Record<string, any>> {
    return this._fingerprintAuthService.authenticate(tracingId);
  }

  @ApiDocs({
    summary: 'Fake scan card login',
    responseSchema: JwtAuthResponse,
  })
  @Post(AUTH_ROUTES.SCAN_CARD)
  public async loginByCard(@TracingID({ transport: Transport.HTTP }) tracingId: string): Promise<any> {
    const res = await this._authService.loginByCard();
    this._wsGateway.sendMessage('scan-employee' as any, {
      success: true,
      data: {
        access_token: res.accessToken,
        username: 'admin',
        userRole: 'admin',
        isIssue: 1,
        isReturn: 1,
        isReplenish: 1,
      },
    });
  }
}
