import { PaginatedResult, PaginationMeta } from '@common/dto';
import { WorkingOrderEntity } from '@dals/mongo/entities';
import { AppHttpException } from '@framework/exception';
import { EntityManager, FilterQuery, FindOptions, ObjectId } from '@mikro-orm/mongodb';
import { Injectable } from '@nestjs/common';

@Injectable()
export class WorkingOrderService {
  constructor(private readonly _em: EntityManager) {}

  public async getWorkingOrders(filters: { page: number; limit: number }): Promise<PaginatedResult<WorkingOrderEntity>> {
    const { limit = 20, page = 1 } = filters;
    // Build filter query
    const where: FilterQuery<WorkingOrderEntity> = {};

    const findOptions: FindOptions<WorkingOrderEntity> = {
      limit,
      offset: (page - 1) * limit,
      orderBy: { createdAt: 'DESC' },
    };

    const [rows, count] = await this._em.findAndCount(WorkingOrderEntity, where, findOptions);

    return new PaginatedResult<WorkingOrderEntity>(
      rows,
      new PaginationMeta({
        page: page,
        limit: limit,
        total: count,
      }),
    );
  }

  public async getWorkingOrder(id: string): Promise<WorkingOrderEntity> {
    const workingOrder = await this._em.findOne(WorkingOrderEntity, new ObjectId(id));
    if (!workingOrder) {
      throw AppHttpException.badRequest({ message: `Working order with ID ${id} not found` });
    }
    return workingOrder;
  }

  public async getWorkingOrderByCode(code: string): Promise<WorkingOrderEntity | null> {
    return this._em.findOne(WorkingOrderEntity, {
      code: code.trim(),
    });
  }

  public async updateWorkingOrder(data: Partial<WorkingOrderEntity>): Promise<WorkingOrderEntity> {
    const workingOrder = new WorkingOrderEntity({
      description: data.description || '',
      wo: data.wo || '',
      vehicleNum: data.vehicleNum || '',
      vehicleType: data.vehicleType || '',
      platform: data.platform || '',
      code: data.code || '',
    });
    await this._em.upsert(workingOrder);
    await this._em.refresh(workingOrder);
    return workingOrder;
  }
}
