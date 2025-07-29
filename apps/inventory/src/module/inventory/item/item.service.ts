import { AuthUserDto } from '@common/dto';
import { BinItemWithIdAndName, IssueItemEntity, WorkOrderItem } from '@entity';
import { AppHttpException } from '@framework/exception';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import { AreaService } from '../area';
import { BinItemService } from '../bin-item';
import { DeviceService } from '../device';
import { JobCardService } from '../job-card';

import { GetItemsRequest, IssueItemRequest } from './dtos/request';
import { IItemRepository, ITEM_REPOSITORY_TOKEN } from './repositories';

@Injectable()
export class ItemService {
  constructor(
    private readonly _areaService: AreaService,
    private readonly _binItemService: BinItemService,
    private readonly _jobCardService: JobCardService,
    private readonly _deviceService: DeviceService,
    @Inject(ITEM_REPOSITORY_TOKEN) private readonly _repository: IItemRepository,
  ) {}

  public async getConfigure(keyword?: string): Promise<BinItemWithIdAndName[]> {
    return this._binItemService.getListBinItem(keyword);
  }

  public async getIssueItems(dto: GetItemsRequest): Promise<IssueItemEntity[]> {
    const dateThreshold = new Date();
    dateThreshold.setHours(0, 0, 0, 0);
    return this._repository.getIssueItems({ ...dto, dateThreshold });
  }

  public async issue(currentUser: any, items: IssueItemEntity[]): Promise<any> {
    const dateThreshold = new Date();
    dateThreshold.setHours(0, 0, 0, 0);

    const processItemPromises = items.map((item) => this._processSingleItemForIssue(item, currentUser, dateThreshold));

    const result = await Promise.all(processItemPromises);

    // 2. Refactor của hàm `formatData` được tích hợp luôn vào đây
    const formattedData = await this.formatIssueData(result);

    // 3. Tính tổng số lượng yêu cầu
    const totalRequestQty = items.reduce((sum, item) => sum + item.quantity, 0);

    // Dữ liệu đã sẵn sàng để gửi đi hoặc xử lý tiếp
    return {
      success: true,
      data: result,
      formattedData,
      requestQty: totalRequestQty,
    };
  }

  private async _processSingleItemForIssue();

  private async _formatIssueData() {}
}
