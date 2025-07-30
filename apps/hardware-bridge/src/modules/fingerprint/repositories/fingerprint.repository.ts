import { FingerprintEntity } from '@entity';

export const FINGERPRINT_REPOSITORY_TOKEN = Symbol('IFingerprintRepository');

export interface IFingerprintRepository {
  findAll(): Promise<FingerprintEntity[]>;
}
