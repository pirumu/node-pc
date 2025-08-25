import { NestFactory } from '@nestjs/core';
import { ProcessWorkerModule } from './process-worker.module';

async function bootstrap() {
  const app = await NestFactory.create(ProcessWorkerModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
