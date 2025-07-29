import { DynamicModule, Global, Module } from '@nestjs/common';
import { ModelDefinition, MongooseModule, MongooseModuleAsyncOptions } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

import mongooseSoftDelete from './plugins/soft-delete/plugin';

type MongoDALModuleOptions = MongooseModuleAsyncOptions & { models: ModelDefinition[]; repositories: any[] };
@Global()
@Module({})
export class MongoDALModule {
  public static forRootAsync(options: MongoDALModuleOptions): DynamicModule {
    const moduleOptions = {
      ...options,
      useFactory: async (...args: any[]): Promise<any> => {
        if (!options.useFactory) {
          throw new Error('MongoDALModule requires options.useFactory');
        }
        const mongooseOptions = await options.useFactory(...args);
        return {
          ...mongooseOptions,
          connectionFactory: (connection: Connection): Connection => {
            connection.plugin(mongooseSoftDelete, {
              overrideMethods: 'all',
              deletedAt: true,
              deletedBy: false,
              deletedByType: String,
            });
            return connection;
          },
        };
      },
    };
    return {
      module: MongoDALModule,
      imports: [MongooseModule.forRootAsync(moduleOptions), MongooseModule.forFeature(options.models)],
      providers: [...options.repositories],
      exports: [MongooseModule, ...options.repositories],
    };
  }
}
