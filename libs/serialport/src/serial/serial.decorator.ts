import { Inject } from '@nestjs/common';

import { SERIAL_PORT_MANAGER } from './serial.constants';

export const InjectSerialManager = () => Inject(SERIAL_PORT_MANAGER);
