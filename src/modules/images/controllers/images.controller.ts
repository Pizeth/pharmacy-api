// -----------------------------------------------------------------
// The Images Controller
// Location: src/modules/images/controllers/images.controller.ts
// -----------------------------------------------------------------
// This controller defines the route and handles the HTTP request/response.

import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  Header,
  ParseEnumPipe,
} from '@nestjs/common';
import { ApiTags, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { ImagesService } from '../services/images.service';
import { ImageOptionsDto } from '../dto/image-options.dto';
import { DiceBearStyle } from 'src/types/commons.enum';

@ApiTags('Images')
@Controller('images')
export class ImagesController {
  constructor(private readonly imagesService: ImagesService) {}

  // This route mirrors the official DiceBear API structure: /:style/:seed.svg
  @Get(':style/:seed.svg')
  @Header('Content-Type', 'image/svg+xml')
  @Header('Cache-Control', 'public, max-age=31536000') // Cache for 1 year
  // Swagger Documentation
  @ApiParam({
    name: 'style',
    enum: DiceBearStyle,
    description: 'The avatar style to use.',
  })
  @ApiParam({
    name: 'seed',
    type: 'string',
    description: 'Any string to create a unique avatar.',
  })
  @ApiQuery({
    name: 'radius',
    type: 'number',
    required: false,
    description: 'Corner radius.',
  })
  @ApiQuery({
    name: 'backgroundColor',
    type: 'string',
    required: false,
    description: 'Hex color without #.',
  })
  // Use @Res({ passthrough: true }) to send a raw response body
  getAvatar(
    // Use the built-in ParseEnumPipe with our new enum. This is clean and type-safe.
    @Param('style', new ParseEnumPipe(DiceBearStyle)) style: DiceBearStyle,
    @Param('seed') seed: string,
    // The global ZodValidationPipe will validate these options
    @Query() options: ImageOptionsDto,
    @Res({ passthrough: true }) res: Response,
  ): string {
    const svg = this.imagesService.generateAvatar(style, seed, options);
    // Setting Last-Modified header is also good practice for caching
    res.setHeader('Last-Modified', new Date().toUTCString());
    return svg;
  }
}
