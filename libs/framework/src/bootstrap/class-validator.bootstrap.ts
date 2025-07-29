import { INestApplication, Type, DynamicModule, ValidationPipe } from '@nestjs/common';
import { useContainer } from 'class-validator';

export function setupValidation(app: INestApplication, module: Type | DynamicModule): ValidationPipe {
  useContainer(app.select(module), { fallbackOnErrors: true });
  return new ValidationPipe({
    transform: true,
    forbidUnknownValues: true,
    // exceptionFactory: exceptionFactory,
  });
}
