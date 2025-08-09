import { AuthClaimsDto, AuthUserDto } from '@common/dto';
import { UserEntity } from '@entity';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtAuthService {
  constructor(private readonly _jwtService: JwtService) {}

  public async verify(jwt: string): Promise<AuthUserDto> {
    const claims = await this._jwtService.verifyAsync<AuthClaimsDto>(jwt);
    return {
      id: claims.id,
      loginId: claims.loginId,
      userCloudId: claims.userCloudId,
      employeeId: claims.employeeId,
      cardNumber: claims.cardNumber,
      role: claims.role,
      genealogy: claims.genealogy,
    };
  }

  public async generateToken(user: UserEntity): Promise<string> {
    try {
      return await this._jwtService.signAsync({
        id: user.id,
        userCloudId: user.cloud.id,
        employeeId: user.employeeId,
        cardNumber: user.cardNumber,
        role: user.role,
        genealogy: user.genealogy,
        loginId: user.loginId,
        // backward compatible
        userLogin: user.loginId,
        userRole: user.role,
        treeCode: user.genealogy,
        ['user_cloud_id']: user.cloud.id,
      });
    } catch (error) {
      throw new InternalServerErrorException('Failed to generate token', error);
    }
  }
}
