import { existsSync } from 'fs';
import { join } from 'path';

import { config } from 'dotenv';

const pathEnv = join(__dirname, '.env');

if (existsSync(pathEnv)) {
  config({
    path: pathEnv,
  });
} else {
  config({
    path: process.env.DOTENV_CONFIG_PATH,
  });
}
