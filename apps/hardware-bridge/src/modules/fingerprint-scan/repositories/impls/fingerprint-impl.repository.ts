import { FingerprintMRepository } from '@dals/mongo/repositories';
import { FingerprintEntity } from '@entity';
import { FingerprintMapper } from '@mapper';
import { Injectable } from '@nestjs/common';

import { IFingerprintRepository } from '../fingerprint.repository';

@Injectable()
export class FingerprintImplRepository implements IFingerprintRepository {
  constructor(private readonly _repository: FingerprintMRepository) {}

  public async findAll(): Promise<FingerprintEntity[]> {
    const docs = await this._repository.findMany({});
    return FingerprintMapper.toEntities(docs);
  }
}
