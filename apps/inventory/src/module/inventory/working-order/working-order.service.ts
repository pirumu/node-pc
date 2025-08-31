import { PaginatedResult, PaginationMeta } from '@common/dto';
import { SiteEntity, WorkingOrderEntity } from '@dals/mongo/entities';
import { AppHttpException } from '@framework/exception';
import { EntityManager, FilterQuery, FindOptions, ObjectId, Reference } from '@mikro-orm/mongodb';
import { Injectable, BadRequestException } from '@nestjs/common';

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

  public async getWorkingOrderByCode(code: string): Promise<WorkingOrderEntity> {
    const workingOrder = await this._em.findOne(WorkingOrderEntity, {
      code: code.trim(),
    });

    if (!workingOrder) {
      throw AppHttpException.badRequest({ message: `Working order with code ${code} not found` });
    }
    return workingOrder;
  }

  public async updateWorkingOrder(id: string, data: Partial<WorkingOrderEntity>): Promise<WorkingOrderEntity> {
    const workingOrder = await this.getWorkingOrder(id);
    this._em.assign(workingOrder, data);
    await this._em.flush();

    return this.getWorkingOrder(id);
  }
}
