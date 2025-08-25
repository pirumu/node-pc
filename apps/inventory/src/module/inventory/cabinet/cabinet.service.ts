import { Injectable } from '@nestjs/common';

import { GetCabinetsRequest } from './dtos/request';

@Injectable()
export class CabinetService {
  constructor() {}

  public async getCabinets(queries: GetCabinetsRequest): Promise<any[]> {
    return [];
    // return this._repository.findAll();
  }

  public async getCabinetById(id: string): Promise<any> {
    // const cabinet = await this._repository.findComplexById(id);
    // if (!cabinet) {
    //   throw new BadRequestException(`Cabin with id ${id} not found`);
    // }
    // return cabinet;
    return null;
  }
}
