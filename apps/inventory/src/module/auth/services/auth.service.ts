import { UserEntity } from '@entity';
import { AppHttpException } from '@framework/exception';
import { Pbkdf2 } from '@framework/hash/pbkdf2';
import { BadRequestException, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';

import { UserService } from '../../user';
import { LoginByPinRequest } from '../dtos';
import { LoginRequest } from '../dtos/request';
import { JwtAuthResponse } from '../dtos/response';

import { JwtAuthService } from './jwt-auth.service';

@Injectable()
export class AuthService {
  private readonly _hashAlgorithm = new Pbkdf2();
  constructor(
    private readonly _jwtAuthService: JwtAuthService,
    private readonly _userService: UserService,
  ) {}

  public async login(payload: LoginRequest): Promise<JwtAuthResponse> {
    const user = await this._prepareUser(payload.loginId);
    await this._isValidPassword(payload.password, user.password);
    return this._generateJwtAuthResponse(user);
  }

  public async loginByPin(dto: LoginByPinRequest): Promise<JwtAuthResponse> {
    const user = await this._prepareUser(dto.loginId);

    this._validateSetting(user);

    await this._isValidPinCode(dto.pin, user.pin());

    return this._generateJwtAuthResponse(user);
  }

  private async _prepareUser(loginId: string): Promise<UserEntity> {
    let user: UserEntity | null = null;

    try {
      user = await this._userService.findByLoginId(loginId);
    } catch (error) {
      throw new InternalServerErrorException('Failed to find user', error);
    }

    if (!user) {
      throw new UnauthorizedException('Unauthorized');
    }
    return user;
  }

  private _validateSetting(user: UserEntity): void {
    if (!user.isEnableTwoFactorAuthentication()) {
      throw new BadRequestException('Please enable two-factor authentication (2FA) to continue');
    }
  }

  private async _isValidPinCode(pinCode: string, hashPinCode: string): Promise<void> {
    const isValid = await this._hashAlgorithm.compare(pinCode, hashPinCode);
    if (!isValid) {
      throw AppHttpException.unauthorized();
    }
  }

  private async _isValidPassword(password: string, hashPassword: string): Promise<void> {
    const isValid = await this._hashAlgorithm.compare(password, hashPassword);
    if (!isValid) {
      throw AppHttpException.unauthorized();
    }
  }

  private async _generateJwtAuthResponse(user: UserEntity): Promise<JwtAuthResponse> {
    const accessToken = await this._jwtAuthService.generateToken(user);

    return new JwtAuthResponse({
      accessToken,
      loginId: user.loginId,
    });
  }
}
