// src/utils/zod-dto.mixin.ts
import { applyDecorators, Type } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import * as z from 'zod';
import { zodMetaToApiProps } from './zod-meta-to-api-props';

export function ZodDto<T extends z.ZodTypeAny>(schema: T): Type<z.infer<T>> {
  class ZodDtoClass {}
  const shape = (schema as any)._def.shape() as Record<string, z.ZodTypeAny>;

  for (const [key, propSchema] of Object.entries(shape)) {
    const opts = zodMetaToApiProps(propSchema);
    applyDecorators(ApiProperty(opts))(ZodDtoClass.prototype, key);
  }

  return ZodDtoClass as any;
}
