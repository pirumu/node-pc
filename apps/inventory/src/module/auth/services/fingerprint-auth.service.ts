import { FingerprintVerifyCommand } from '@common/commands/auth';
import { FINGERPRINT_RESPONSE_ID, IContextualResponse } from '@fingerprint-scanner';
import { TRACING_ID } from '@framework/constants';
import { PublisherService, Transport } from '@framework/publisher';
import { Injectable, InternalServerErrorException, Logger, UnauthorizedException } from '@nestjs/common';

import { UserService } from '../../user';
import { JwtAuthResponse } from '../dtos/response';

import { AuthService } from './auth.service';

@Injectable()
export class FingerprintAuthService {
  private readonly _logger = new Logger(FingerprintAuthService.name);

  constructor(
    private readonly _publisherService: PublisherService,
    private readonly _authService: AuthService,
    private readonly _userService: UserService,
  ) {}

  public async authenticate(tracingId: string): Promise<JwtAuthResponse> {
    const startTime = Date.now();
    try {
      const result = await this._publisherService.publish<IContextualResponse>(
        Transport.TCP,
        FingerprintVerifyCommand.CHANNEL,
        {},
        {
          [TRACING_ID]: tracingId,
        },
      );

      const objectId = this._processVerificationResult(result);
      const user = null; //await this._findUserByFingerprint(objectId);
      return null as any;
      // const accessToken = ''; // await this._authService.generateToken(user);
      //
      // const duration = Date.now() - startTime;
      // this._logger.log(`Fingerprint authentication successful in ${duration}ms`, {
      //   userId: user.id,
      //   objectId,
      // });
      // return new JwtAuthResponse({
      //   accessToken,
      //   loginId: user.loginId,
      // });
    } catch (error) {
      const duration = Date.now() - startTime;
      this._logger.error(`Fingerprint authentication failed after ${duration}ms`, {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  private _processVerificationResult(verifyResult: IContextualResponse): string {
    this._logger.debug('Verification result received', {
      id: verifyResult.id,
    });

    if (verifyResult.id === FINGERPRINT_RESPONSE_ID.ERROR_CONNECT) {
      throw new InternalServerErrorException('Fingerprint hardware connection failed');
    }

    if (verifyResult.id === FINGERPRINT_RESPONSE_ID.ERROR_VERIFY) {
      throw new UnauthorizedException('Fingerprint verification failed');
    }

    if (verifyResult.id !== FINGERPRINT_RESPONSE_ID.SUCCESS_VERIFY) {
      throw new UnauthorizedException('Authentication failed');
    }

    this._logger.log('Verification result received', verifyResult);

    const { data: objectId } = verifyResult;

    if (!objectId) {
      throw new InternalServerErrorException('Invalid verification response');
    }

    return objectId;
  }

  // private async _findUserByFingerprint(objectId: string): Promise<UserEntity> {
  //   const fingerprint = await this._fingerprintsService.findByFingerprint(objectId);
  //
  //   if (!fingerprint) {
  //     this._logger.warn('Fingerprint not found', {
  //       objectId,
  //     });
  //     throw new UnauthorizedException('Authentication failed');
  //   }
  //
  //   const user = null;
  //   // await this._userService.findById(fingerprint.userId);
  //
  //   if (!user) {
  //     this._logger.warn('User not found for fingerprint', {
  //       objectId,
  //       userId: fingerprint.userId,
  //     });
  //     throw new UnauthorizedException('Authentication failed');
  //   }
  //
  //   return user;
  // }
}
