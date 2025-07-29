#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';

interface ModuleConfig {
  name: string;
  pascalCase: string;
  kebabCase: string;
  camelCase: string;
  upperCase: string;
}

// Utility functions
const toPascalCase = (str: string): string => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();

const toKebabCase = (str: string): string => str.toLowerCase().replace(/([a-z])([A-Z])/g, '$1-$2');

const toCamelCase = (str: string): string => str.charAt(0).toLowerCase() + str.slice(1);

const toUpperCase = (str: string): string => str.toUpperCase().replace(/[-\s]/g, '_');

// Get module path from command line argument
const modulePath: string | undefined = process.argv[2];

if (!modulePath) {
  console.error('❌ Please provide module path!');
  console.log('📖 Usage: ts-node generate-module.ts <module-path>');
  console.log('📝 Example: ts-node generate-module.ts user');
  console.log('📝 Example: ts-node generate-module.ts module/system/port');
  console.log('📝 Example: ts-node generate-module.ts feature/auth/login');
  process.exit(1);
}

// Parse module path and name
const pathParts = modulePath.split('/');
const moduleName = pathParts[pathParts.length - 1]; // Get last part as module name
const baseDir = 'apps/inventory/src';
const fullModulePath = path.join(baseDir, modulePath);

// Module configuration
const moduleConfig: ModuleConfig = {
  name: moduleName.toLowerCase(),
  pascalCase: toPascalCase(moduleName),
  kebabCase: toKebabCase(moduleName),
  camelCase: toCamelCase(moduleName),
  upperCase: toUpperCase(moduleName),
};

console.log(`🚀 Generating module: ${moduleConfig.name}`);
console.log(`📍 Path: ${fullModulePath}`);

// Create directory structure
const directories: string[] = [
  fullModulePath,
  `${fullModulePath}/repositories`,
  `${fullModulePath}/repositories/impls`,
  `${fullModulePath}/dtos`,
  `${fullModulePath}/dtos/response`,
];

directories.forEach((dir: string) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created directory: ${dir}`);
  }
});

// File templates
const templates: Record<string, string> = {
  // Main index.ts
  [`${fullModulePath}/index.ts`]: `export * from './${moduleConfig.kebabCase}.module';
export * from './${moduleConfig.kebabCase}.service';
`,

  // Module file
  [`${fullModulePath}/${moduleConfig.kebabCase}.module.ts`]: `import { Module } from '@nestjs/common';

import { CONTROLLERS, REPOSITORY_PROVIDERS, SERVICES_EXPORTS, SERVICES_PROVIDERS } from './${moduleConfig.kebabCase}.providers';

@Module({
  imports: [],
  controllers: [...CONTROLLERS],
  providers: [...SERVICES_PROVIDERS, ...REPOSITORY_PROVIDERS],
  exports: [...SERVICES_EXPORTS],
})
export class ${moduleConfig.pascalCase}Module {}
`,

  // Service file
  [`${fullModulePath}/${moduleConfig.kebabCase}.service.ts`]: `import { ${moduleConfig.pascalCase}Entity } from '@entity';
import { Inject, Injectable } from '@nestjs/common';

import { ${moduleConfig.upperCase}_REPOSITORY_TOKEN, I${moduleConfig.pascalCase}Repository } from './repositories';

@Injectable()
export class ${moduleConfig.pascalCase}Service {
  constructor(@Inject(${moduleConfig.upperCase}_REPOSITORY_TOKEN) private readonly _repository: I${moduleConfig.pascalCase}Repository) {}

  public async get${moduleConfig.pascalCase}s(): Promise<${moduleConfig.pascalCase}Entity[]> {
    return this._repository.findAll();
  }

  public async get${moduleConfig.pascalCase}ById(id: string): Promise<${moduleConfig.pascalCase}Entity | null> {
    return this._repository.findById(id);
  }

  public async create${moduleConfig.pascalCase}(data: Partial<${moduleConfig.pascalCase}Entity>): Promise<${moduleConfig.pascalCase}Entity> {
    return this._repository.create(data);
  }

  public async update${moduleConfig.pascalCase}(id: string, data: Partial<${moduleConfig.pascalCase}Entity>): Promise<${moduleConfig.pascalCase}Entity | null> {
    return this._repository.update(id, data);
  }

  public async delete${moduleConfig.pascalCase}(id: string): Promise<boolean> {
    return this._repository.delete(id);
  }
}
`,

  // Controller file
  [`${fullModulePath}/${moduleConfig.kebabCase}.controller.ts`]: `import { BaseController } from '@framework/controller';
import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { ApiSecurity, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { ${moduleConfig.upperCase}_ROUTES } from './${moduleConfig.kebabCase}.constants';
import { ${moduleConfig.pascalCase}Service } from './${moduleConfig.kebabCase}.service';
import { Get${moduleConfig.pascalCase}sResponse, Get${moduleConfig.pascalCase}Response } from './dtos/response';

@ApiTags('${moduleConfig.pascalCase}')
@ApiSecurity('authorization')
@Controller(${moduleConfig.upperCase}_ROUTES.GROUP)
export class ${moduleConfig.pascalCase}Controller extends BaseController {
  constructor(private readonly _${moduleConfig.camelCase}Service: ${moduleConfig.pascalCase}Service) {
    super();
  }

  @Get(${moduleConfig.upperCase}_ROUTES.GET_${moduleConfig.upperCase}S)
  @ApiOperation({ summary: 'Get all ${moduleConfig.name}s' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved ${moduleConfig.name}s', type: [Get${moduleConfig.pascalCase}sResponse] })
  public async get${moduleConfig.pascalCase}s(): Promise<Get${moduleConfig.pascalCase}sResponse[]> {
    const result = await this._${moduleConfig.camelCase}Service.get${moduleConfig.pascalCase}s();
    return result.map((${moduleConfig.camelCase}) => this.toDto<Get${moduleConfig.pascalCase}sResponse>(Get${moduleConfig.pascalCase}sResponse, ${moduleConfig.camelCase}));
  }

  @Get(${moduleConfig.upperCase}_ROUTES.GET_${moduleConfig.upperCase})
  @ApiOperation({ summary: 'Get ${moduleConfig.name} by ID' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved ${moduleConfig.name}', type: Get${moduleConfig.pascalCase}Response })
  @ApiResponse({ status: 404, description: '${moduleConfig.pascalCase} not found' })
  public async get${moduleConfig.pascalCase}(@Param('id') id: string): Promise<Get${moduleConfig.pascalCase}Response | null> {
    const result = await this._${moduleConfig.camelCase}Service.get${moduleConfig.pascalCase}ById(id);
    if (!result) return null;
    return this.toDto<Get${moduleConfig.pascalCase}Response>(Get${moduleConfig.pascalCase}Response, result);
  }
}
`,

  // Constants file
  [`${fullModulePath}/${moduleConfig.kebabCase}.constants.ts`]: `export const ${moduleConfig.upperCase}_ROUTES = {
  GROUP: '${moduleConfig.name}s',
  GET_${moduleConfig.upperCase}S: 'list',
  GET_${moduleConfig.upperCase}: ':id',
  CREATE_${moduleConfig.upperCase}: '',
  UPDATE_${moduleConfig.upperCase}: ':id',
  DELETE_${moduleConfig.upperCase}: ':id',
};

export const ${moduleConfig.upperCase}_MESSAGES = {
  NOT_FOUND: '${moduleConfig.pascalCase} not found',
  CREATED_SUCCESS: '${moduleConfig.pascalCase} created successfully',
  UPDATED_SUCCESS: '${moduleConfig.pascalCase} updated successfully',
  DELETED_SUCCESS: '${moduleConfig.pascalCase} deleted successfully',
};
`,

  // Providers file
  [`${fullModulePath}/${moduleConfig.kebabCase}.providers.ts`]: `import { Provider } from '@nestjs/common';

import { ${moduleConfig.pascalCase}Controller } from './${moduleConfig.kebabCase}.controller';
import { ${moduleConfig.pascalCase}Service } from './${moduleConfig.kebabCase}.service';
import { ${moduleConfig.upperCase}_REPOSITORY_TOKEN } from './repositories';
import { ${moduleConfig.pascalCase}ImplRepository } from './repositories/impls';

export const CONTROLLERS = [${moduleConfig.pascalCase}Controller];
export const SERVICES_PROVIDERS = [${moduleConfig.pascalCase}Service];
export const SERVICES_EXPORTS = [${moduleConfig.pascalCase}Service];

export const REPOSITORY_PROVIDERS: Provider[] = [
  {
    provide: ${moduleConfig.upperCase}_REPOSITORY_TOKEN,
    useClass: ${moduleConfig.pascalCase}ImplRepository,
  },
];
`,

  // Repository interface
  [`${fullModulePath}/repositories/${moduleConfig.kebabCase}.repository.ts`]: `import { ${moduleConfig.pascalCase}Entity } from '@entity';

export const ${moduleConfig.upperCase}_REPOSITORY_TOKEN = Symbol('I${moduleConfig.pascalCase}Repository');

export interface I${moduleConfig.pascalCase}Repository {
  findAll(): Promise<${moduleConfig.pascalCase}Entity[]>;
  findById(id: string): Promise<${moduleConfig.pascalCase}Entity | null>;
  create(data: Partial<${moduleConfig.pascalCase}Entity>): Promise<${moduleConfig.pascalCase}Entity>;
  update(id: string, data: Partial<${moduleConfig.pascalCase}Entity>): Promise<${moduleConfig.pascalCase}Entity | null>;
  delete(id: string): Promise<boolean>;
}
`,

  // Repository index
  [`${fullModulePath}/repositories/index.ts`]: `export * from './${moduleConfig.kebabCase}.repository';
`,

  // Repository implementation
  [`${fullModulePath}/repositories/impls/${moduleConfig.kebabCase}-impl.repository.ts`]: `import { ${moduleConfig.pascalCase}MRepository } from '@dals/mongo/repositories';

import { I${moduleConfig.pascalCase}Repository } from '../${moduleConfig.kebabCase}.repository';
import { ${moduleConfig.pascalCase}Entity } from '@entity';
import { ${moduleConfig.pascalCase}Mapper } from '@mapper';

export class ${moduleConfig.pascalCase}ImplRepository implements I${moduleConfig.pascalCase}Repository {
  constructor(private readonly _repository: ${moduleConfig.pascalCase}MRepository) {}

  public async findAll(): Promise<${moduleConfig.pascalCase}Entity[]> {
    const results = await this._repository.findMany({});
    return ${moduleConfig.pascalCase}Mapper.toEntities(results);
  }

  public async findById(id: string): Promise<${moduleConfig.pascalCase}Entity | null> {
    const result = await this._repository.findOne({ _id: id });
    if (!result) return null;
    return ${moduleConfig.pascalCase}Mapper.toEntity(result);
  }

  public async create(data: Partial<${moduleConfig.pascalCase}Entity>): Promise<${moduleConfig.pascalCase}Entity> {
    const document = ${moduleConfig.pascalCase}Mapper.toDocument(data);
    const result = await this._repository.create(document);
    return ${moduleConfig.pascalCase}Mapper.toEntity(result);
  }

  public async update(id: string, data: Partial<${moduleConfig.pascalCase}Entity>): Promise<${moduleConfig.pascalCase}Entity | null> {
    const document = ${moduleConfig.pascalCase}Mapper.toDocument(data);
    const result = await this._repository.findOneAndUpdate({ _id: id }, document, { new: true });
    if (!result) return null;
    return ${moduleConfig.pascalCase}Mapper.toEntity(result);
  }

  public async delete(id: string): Promise<boolean> {
    const result = await this._repository.deleteOne({ _id: id });
    return result.deletedCount > 0;
  }
}
`,

  // Repository impls index
  [`${fullModulePath}/repositories/impls/index.ts`]: `export * from './${moduleConfig.kebabCase}-impl.repository';
`,

  // DTOs index
  [`${fullModulePath}/dtos/index.ts`]: `export * from './response';
`,

  // Response DTOs index
  [`${fullModulePath}/dtos/response/index.ts`]: `export * from './get-${moduleConfig.kebabCase}s.response';
export * from './get-${moduleConfig.kebabCase}.response';
`,

  // Get list response DTO
  [`${fullModulePath}/dtos/response/get-${moduleConfig.kebabCase}s.response.ts`]: `import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class Get${moduleConfig.pascalCase}sResponse {
  @ApiProperty({ description: 'Unique identifier', example: '507f1f77bcf86cd799439011' })
  @Expose()
  id: string;

  @ApiProperty({ description: 'Name of the ${moduleConfig.name}', example: 'Sample ${moduleConfig.name}' })
  @Expose()
  name: string;

  @ApiProperty({ description: 'Description of the ${moduleConfig.name}', example: 'This is a sample ${moduleConfig.name}', required: false })
  @Expose()
  description?: string;

  @ApiProperty({ description: 'Creation timestamp', example: '2024-01-01T00:00:00.000Z' })
  @Expose()
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp', example: '2024-01-01T00:00:00.000Z' })
  @Expose()
  updatedAt: Date;

  // TODO: Add more properties as needed
}
`,

  // Get single response DTO
  [`${fullModulePath}/dtos/response/get-${moduleConfig.kebabCase}.response.ts`]: `import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class Get${moduleConfig.pascalCase}Response {
  @ApiProperty({ description: 'Unique identifier', example: '507f1f77bcf86cd799439011' })
  @Expose()
  id: string;

  @ApiProperty({ description: 'Name of the ${moduleConfig.name}', example: 'Sample ${moduleConfig.name}' })
  @Expose()
  name: string;

  @ApiProperty({ description: 'Description of the ${moduleConfig.name}', example: 'This is a sample ${moduleConfig.name}', required: false })
  @Expose()
  description?: string;

  @ApiProperty({ description: 'Creation timestamp', example: '2024-01-01T00:00:00.000Z' })
  @Expose()
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp', example: '2024-01-01T00:00:00.000Z' })
  @Expose()
  updatedAt: Date;

  // TODO: Add more properties as needed
}
`,
};

// Create files
Object.entries(templates).forEach(([filePath, content]) => {
  fs.writeFileSync(filePath, content);
  console.log(`📄 Created file: ${filePath}`);
});

console.log(`\n✅ Module "${moduleConfig.name}" has been created successfully!`);
console.log(`📍 Location: ${fullModulePath}`);
console.log(`\n📋 Generated structure:`);
console.log(`📁 ${fullModulePath}/`);
console.log(`├── 📄 index.ts`);
console.log(`├── 📄 ${moduleConfig.kebabCase}.module.ts`);
console.log(`├── 📄 ${moduleConfig.kebabCase}.service.ts`);
console.log(`├── 📄 ${moduleConfig.kebabCase}.controller.ts`);
console.log(`├── 📄 ${moduleConfig.kebabCase}.constants.ts`);
console.log(`├── 📄 ${moduleConfig.kebabCase}.providers.ts`);
console.log(`├── 📁 dtos/`);
console.log(`│   ├── 📄 index.ts`);
console.log(`│   └── 📁 response/`);
console.log(`│       ├── 📄 index.ts`);
console.log(`│       ├── 📄 get-${moduleConfig.kebabCase}s.response.ts`);
console.log(`│       └── 📄 get-${moduleConfig.kebabCase}.response.ts`);
console.log(`└── 📁 repositories/`);
console.log(`    ├── 📄 index.ts`);
console.log(`    ├── 📄 ${moduleConfig.kebabCase}.repository.ts`);
console.log(`    └── 📁 impls/`);
console.log(`        ├── 📄 index.ts`);
console.log(`        └── 📄 ${moduleConfig.kebabCase}-impl.repository.ts`);
