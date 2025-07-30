import { PartialType } from '@nestjs/mapped-types';

import { CreateCulockDto } from './create-culock.dto';

export class UpdateCulockDto extends PartialType(CreateCulockDto) {
  id: number;
}
