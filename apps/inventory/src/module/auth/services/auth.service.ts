import { PaginationMeta } from '@common/dto';
import { FacialRecognitionEntity, TabletEntity, UserEntity } from '@dals/mongo/entities';
import { AppHttpException } from '@framework/exception';
import { BCrypto } from '@framework/hash/bcrypto';
import { EntityRepository, ObjectId } from '@mikro-orm/mongodb';
import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable } from '@nestjs/common';

import { LoginByPinRequest, LoginByFaceRequest, LoginRequest } from '../dtos/request';
import { JwtAuthResponse } from '../dtos/response';

import { JwtAuthService } from './jwt-auth.service';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  private readonly _signatureExpireInMs: number = 10000; //10s
  private readonly _signatureMap: Map<
    string,
    {
      userId: string;
      timeout: any;
    }
  > = new Map<
    string,
    {
      userId: string;
      timeout: any;
    }
  >();

  private readonly _hashAlgorithm = new BCrypto();
  constructor(
    private readonly _jwtAuthService: JwtAuthService,

    @InjectRepository(UserEntity) private readonly _userRepository: EntityRepository<UserEntity>,
    @InjectRepository(TabletEntity) private readonly _tabletRepository: EntityRepository<TabletEntity>,
    @InjectRepository(FacialRecognitionEntity) private readonly _facialRecognitionRepository: EntityRepository<FacialRecognitionEntity>,
  ) {}

  public async loginByPin(clientId: string, dto: LoginByPinRequest): Promise<JwtAuthResponse> {
    const signature = this._signatureMap.get(dto.signature);
    if (!signature) {
      this._signatureMap.delete(dto.signature);
      throw AppHttpException.unauthorized({ message: 'Invalid signature' });
    }
    const user = await this._userRepository.findOne({ _id: new ObjectId(signature.userId) });

    this._signatureMap.delete(dto.signature);

    if (!user) {
      throw AppHttpException.unauthorized();
    }

    await this._isValidPinCode(clientId, user.pin, dto.pin);

    return this._generateJwtAuthResponse(user);
  }

  public async loginByFaceData(clientId: string, dto: LoginByFaceRequest): Promise<JwtAuthResponse> {
    const faceData = await this._facialRecognitionRepository.findOne(
      {
        data: dto.data,
      },
      {
        populate: ['user'],
      },
    );

    if (!faceData || !faceData.user) {
      throw AppHttpException.unauthorized();
    }
    // todo: clear
    // if (await this._is2FaEnable(clientId)) {
    //   const key = randomBytes(32).toString('hex');
    //   this._addSignature(faceData.user.id, key);
    //   return new JwtAuthResponse({
    //     signature: key,
    //     signatureExpireInMs: this._signatureExpireInMs,
    //   });
    // }
    return this._generateJwtAuthResponse(faceData.user.unwrap());
  }

  public async getFacialRecognitions(page: number, limit: number): Promise<{ rows: FacialRecognitionEntity[]; meta: PaginationMeta }> {
    const [rows, count] = await Promise.all([
      this._facialRecognitionRepository.findAll({
        limit,
        offset: (page - 1) * limit,
      }),
      this._facialRecognitionRepository.count(),
    ]);

    return {
      rows,
      meta: new PaginationMeta({
        limit,
        page,
        total: count,
      }),
    };
  }

  private _addSignature(userId: string, key: string) {
    const signature = this._signatureMap.get(key);
    if (signature) {
      clearTimeout(signature.timeout);
    }
    const timeout = setTimeout(() => {
      this._signatureMap.delete(key);
    }, 10000); // 10s.

    this._signatureMap.set(key, { userId, timeout });
  }

  private async _is2FaEnable(clientId?: string, clusterId?: string): Promise<boolean> {
    const conditions: Array<Record<string, any>> = [];
    if (clientId) {
      conditions.push({
        clientId,
      });
    }
    if (clusterId) {
      conditions.push({
        cluster: {
          _id: new ObjectId(clusterId),
        },
      });
    }

    const tablet = await this._tabletRepository.findOne(
      {
        $or: conditions,
      },
      {
        fields: ['isMfaEnabled'],
      },
    );

    if (!tablet) {
      throw AppHttpException.unauthorized({ message: 'Invalid client id' });
    }
    return tablet.isMfaEnabled;
  }

  private async _isValidPinCode(clientId: string, userPinCode: string, requestPinCode?: string): Promise<void> {
    const isMfa = await this._is2FaEnable(clientId);

    if (isMfa && requestPinCode !== userPinCode) {
      throw AppHttpException.unauthorized({ message: 'Invalid pin code' });
    }
  }

  private async _isValidPassword(password: string, hashPassword: string): Promise<void> {
    hashPassword = hashPassword.replace('$2y', '$2a');
    const isValid = await this._hashAlgorithm.compare(password, hashPassword);
    if (!isValid) {
      throw AppHttpException.unauthorized();
    }
  }

  private async _generateJwtAuthResponse(user: UserEntity): Promise<JwtAuthResponse> {
    const accessToken = await this._jwtAuthService.generateToken(user);

    return new JwtAuthResponse({
      username: user.username,
      accessToken,
    });
  }

  public async loginByCard(cardId: string): Promise<[string, JwtAuthResponse][]> {
    const user = await this._userRepository.findOne({ cardId: cardId }, { populate: ['sites', 'sites.clusters'] });
    if (!user) {
      throw AppHttpException.unauthorized();
    }

    const clusterIds = user.sites.map((s) => s.clusters.map((c) => c.id)).flat();

    const results: [string, JwtAuthResponse][] = [];
    for (const clusterId of clusterIds) {
      try {
        const isEnabled = await this._is2FaEnable(undefined, clusterId);
        console.log(isEnabled);
        if (isEnabled) {
          const key = randomBytes(32).toString('hex');
          this._addSignature(user.id, key);
          results.push([
            clusterId,
            new JwtAuthResponse({
              signature: key,
              signatureExpireInMs: this._signatureExpireInMs,
            }),
          ]);
        }
      } catch (_error) {
        // skip if not existed
      }
    }

    if (results.length === 0) {
      const jwtRes = await this._generateJwtAuthResponse(user);
      results.push(['none', jwtRes]);
    }
    return results;
  }

  public async login(payload: LoginRequest): Promise<JwtAuthResponse> {
    const user = await this._userRepository.findOne({ username: payload.username });
    if (!user) {
      throw AppHttpException.unauthorized();
    }
    await this._isValidPassword(payload.password, user.password);
    return this._generateJwtAuthResponse(user);
  }
}
