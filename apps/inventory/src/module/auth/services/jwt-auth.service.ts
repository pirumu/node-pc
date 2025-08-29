import { AuthClaimsDto, AuthUserDto } from '@common/dto';
import { UserEntity } from '@dals/mongo/entities';
import { AppHttpException } from '@framework/exception';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtAuthService {
  constructor(private readonly _jwtService: JwtService) {}

  public async verify(jwt: string): Promise<AuthUserDto> {
    const claims = await this._jwtService.verifyAsync<AuthClaimsDto>(jwt);
    return {
      id: claims.id,
      username: claims.username,
      employeeId: claims.employeeId,
      cardId: claims.cardId,
      role: claims.role,
    };
  }

  public async generateToken(user: UserEntity): Promise<string> {
    try {
      return await this._jwtService.signAsync(
        {
          id: user.id,
          cardId: user.cardId,
          employeeId: user.employeeId,
          username: user.username,
          role: user.role.id,
        },
        {
          expiresIn: '1d',
        },
      );
    } catch (error) {
      throw AppHttpException.internalServerError({
        message: 'Failed to generate token',
        data: {
          error: {
            name: error.name,
            message: error.message,
          },
        },
      });
    }
  }
}
