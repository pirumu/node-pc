import { NestFactory } from '@nestjs/core';
import { SyncWorkerModule } from './sync-worker.module';

async function bootstrap() {
  const app = await NestFactory.create(SyncWorkerModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
