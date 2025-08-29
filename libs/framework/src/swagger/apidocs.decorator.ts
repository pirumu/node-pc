import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiExtraModels,
  ApiHeader,
  ApiHeaders,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { PaginationResponse } from '@common/dto';

type ApiDocOptions = {
  summary?: string;
  description?: string;
  responseSchema?: any;
  paginatedResponseSchema?: any;
  body?: any;
};

function getSwaggerSchema(dto: any): any {
  return dto;
}

export const ApiDocs = (options: ApiDocOptions) => {
  const decorators: any = [];

  if (options.paginatedResponseSchema) {
    decorators.push(
      ApiExtraModels(PaginationResponse, options.paginatedResponseSchema),
      ApiOkResponse({
        schema: {
          allOf: [
            { $ref: getSchemaPath(PaginationResponse) },
            {
              required: ['data'],
              properties: {
                data: {
                  type: 'array',
                  items: { $ref: getSchemaPath(options.paginatedResponseSchema) },
                },
              },
            },
          ],
        },
      }),
    );
  } else {
    decorators.push(
      ApiOkResponse({
        type: getSwaggerSchema(options.responseSchema),
      }),
    );
  }

  if (options.body) {
    decorators.push(
      ApiBody({
        type: options.body,
      }),
    );
  }

  if (options.summary || options.description) {
    decorators.push(ApiOperation({ summary: options.summary, description: options.description }));
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
        decorators.push(ApiBearerAuth());
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

export const ApiSignatureSecurity = () =>
  applyDecorators(
    ApiHeaders([
      {
        name: 'x-client-id',
      },
      {
        name: 'x-timestamp',
      },
      {
        name: 'x-signature',
      },
    ]),
  );
