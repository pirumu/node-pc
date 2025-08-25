import { Injectable } from '@nestjs/common';

import { TabletService } from '../../system/tablet';

@Injectable()
export class TabletAuthService {
  constructor(private readonly _tabletService: TabletService) {}

  public async verify(deviceKey: string): Promise<boolean> {
    // return this._tabletService.exist(deviceKey);
    return true;
  }
}
