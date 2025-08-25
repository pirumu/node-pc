import { AnyEntity } from '@mikro-orm/core';
import { EntityName, MikroOrmModule, MikroOrmModuleAsyncOptions } from '@mikro-orm/nestjs';
import { DynamicModule, Global, Module } from '@nestjs/common';

type MongoDALModuleOptions = MikroOrmModuleAsyncOptions & { entities: EntityName<AnyEntity>[] };

@Global()
@Module({})
export class MongoDALModule {
  public static forRootAsync(options: MongoDALModuleOptions): DynamicModule {
    return {
      module: MongoDALModule,
      imports: [MikroOrmModule.forRootAsync(options), MikroOrmModule.forFeature(options.entities)],
      exports: [MikroOrmModule],
    };
  }
}
