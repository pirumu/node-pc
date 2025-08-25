import { Provider } from '@nestjs/common';

import { ClusterController } from './cluster.controller';
import { ClusterService } from './cluster.service';

export const CONTROLLERS = [ClusterController];
export const SERVICES_PROVIDERS = [ClusterService];
export const SERVICES_EXPORTS = [ClusterService];

export const REPOSITORY_PROVIDERS: Provider[] = [];
