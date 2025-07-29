import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiHeader, ApiOkResponse, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger/dist/decorators/api-property.decorator';
import { isArray } from 'class-validator';

class ResponseDto {
  success: true;
  data?: object | Array<any>;
}

type ApiDocOptions = {
  summary?: string;
  responseSchema?: any;
  body?: any;
};

function getSwaggerSchema(dto: any): any {
  dto = dto ?? {};

  class TemplateSchema extends ResponseDto {
    @ApiProperty({ type: dto })
    declare data: any;
  }

  const generateClass = (name: any) =>
    ({
      [name]: class extends TemplateSchema {},
    })[name];

  const dtoName = isArray(dto) ? dto[0].name : dto.name;

  const uniqueClassName = (isArray(dto) ? 'ArrayResponseSchema' : 'ResponseSchema') + dtoName;

  return generateClass(uniqueClassName);
}

export const ApiDocs = (options: ApiDocOptions) => {
  const decorators: any = [];

  decorators.push(
    ApiOkResponse({
      type: getSwaggerSchema(options.responseSchema),
    }),
  );

  if (options.body) {
    decorators.push(
      ApiBody({
        type: options.body,
      }),
    );
  }

  if (options.summary) {
    decorators.push(ApiOperation({ summary: options.summary }));
  }

  return applyDecorators(...decorators);
};

type ControllerDocs = {
  tag?: string;
  securityKey?: string;
  securitySchema?: 'bearer' | 'auth-key' | 'header' | 'b-h';
};

export const ControllerDocs = (options: ControllerDocs) => {
  const decorators: any = [];
  if (options.tag) {
    decorators.push(ApiTags(options.tag));
  }
  if (options.securitySchema) {
    switch (options.securitySchema) {
      case 'bearer':
        decorators.push(ApiBearerAuth(options.securityKey));
        break;
      case 'auth-key':
        decorators.push(ApiSecurity(options.securityKey || 'authorization'));
        break;
      case 'header':
        decorators.push(
          ApiHeader({
            name: options.securityKey || 'x-auth-key',
            description: 'API Key for authentication',
            required: true,
            schema: {
              type: 'string',
            },
          }),
        );
        break;
      case 'b-h':
        decorators.push(ApiSecurity('authorization'));
        decorators.push(
          ApiHeader({
            name: options.securityKey || 'x-auth-key',
            description: 'API Key for authentication',
            required: true,
            schema: {
              type: 'string',
            },
          }),
        );
        break;
    }
  }
  return applyDecorators(...decorators);
};
