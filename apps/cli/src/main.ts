import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

import { CliModule } from './cli.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(CliModule, {
    transport: Transport.TCP,
    options: {
      host: '127.0.0.1',
      port: 3000,
    },
  });
  await app.listen();
}
bootstrap();
