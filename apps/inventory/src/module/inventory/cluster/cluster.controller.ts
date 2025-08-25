import { PaginationResponse } from '@common/dto';
import { BaseController } from '@framework/controller';
import { ApiDocs, ControllerDocs } from '@framework/swagger';
import { Controller, Get, Query } from '@nestjs/common';

import { CLUSTER_ROUTES } from './cluster.constants';
import { ClusterService } from './cluster.service';
import { GetClustersRequest } from './dtos/request';
import { GetClusterResponse } from './dtos/response';

@ControllerDocs({
  tag: 'Cluster',
})
@Controller(CLUSTER_ROUTES.GROUP)
export class ClusterController extends BaseController {
  constructor(private readonly _clusterService: ClusterService) {
    super();
  }

  @ApiDocs({
    paginatedResponseSchema: GetClusterResponse,
  })
  @Get(CLUSTER_ROUTES.GET_CLUSTERS)
  public async getClusters(@Query() query: GetClustersRequest): Promise<PaginationResponse<GetClusterResponse>> {
    const { rows, meta } = await this._clusterService.getClusters(query.page || 1, query.limit || 10, query.enrich);
    const results = rows.map((row) => this.toDto(GetClusterResponse, row.toPOJO()));
    return new PaginationResponse(results, meta);
  }
}
