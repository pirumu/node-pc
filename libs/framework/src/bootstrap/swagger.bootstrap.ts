import { INestApplication, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(
  app: INestApplication,
  config: {
    enabled: boolean;
    title: string;
    description: string;
    version: string;
    apiBasePath: string;
    path: string;
  },
): void {
  if (config.enabled) {
    const options = new DocumentBuilder()
      .setTitle(config.title)
      .setDescription(config.description)
      .setVersion(config.version)
      .addServer(config.apiBasePath)
      .addBearerAuth({
        in: 'header',
        name: 'authorization',
        bearerFormat: 'Bearer',
        type: 'apiKey',
      })
      .build();
    const document = SwaggerModule.createDocument(app, options);

    SwaggerModule.setup(config.path, app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
    Logger.log('Swagger initialized', 'SwaggerBootstrap');
  }
}
