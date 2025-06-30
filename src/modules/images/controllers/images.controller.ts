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
  ParseEnumPipe,
  Header,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { ImagesService } from '../services/images.service';
import { ImageOptionsDto } from '../dto/image-options.dto';
import {
  // AvailableFonts,
  DiceBearStyle,
  ImageFormat,
} from 'src/types/commons.enum';

@ApiTags('Images')
@Controller('images')
export class ImagesController {
  private readonly logger = new Logger(ImagesController.name);
  constructor(private readonly imagesService: ImagesService) {}

  // This route mirrors the official DiceBear API structure: /:style/:fomart
  // @Get(':style/:format?')
  // // Swagger Documentation
  // @ApiParam({
  //   name: 'style',
  //   enum: DiceBearStyle,
  //   description: 'The avatar style to use.',
  // })
  // @ApiParam({
  //   name: 'format',
  //   enum: ImageFormat,
  //   required: false,
  //   description: 'The desired file format, Defaults to svg',
  //   allowEmptyValue: true,
  // })
  // @ApiParam({
  //   name: 'seed',
  //   type: 'string',
  //   description: 'Any string to create a unique avatar.',
  // })
  // @ApiQuery({
  //   name: 'radius',
  //   type: 'number',
  //   required: false,
  //   description: 'Corner radius.',
  // })
  // @ApiQuery({
  //   name: 'backgroundColor',
  //   type: 'string',
  //   required: false,
  //   description: 'Hex color without #.',
  // })
  // @ApiQuery({
  //   name: 'fontWeight',
  //   type: 'number',
  //   required: false,
  //   description: 'Only for "initials" style (100-900).',
  // })
  // @ApiQuery({
  //   name: 'fontFamily',
  //   enum: AvailableFonts,
  //   required: false,
  //   description: 'Custom font for "initials" style.',
  // })
  // // Use @Res({ passthrough: true }) to send a raw response body
  // async getAvatar(
  //   // Use the built-in ParseEnumPipe with our new enum. This is clean and type-safe.
  //   @Param('style', new ParseEnumPipe(DiceBearStyle)) style: DiceBearStyle,
  //   @Param('format', new ParseEnumPipe(ImageFormat, { optional: true }))
  //   format: ImageFormat = ImageFormat.SVG,
  //   // The global ZodValidationPipe will validate these options
  //   @Query() options: ImageOptionsDto,
  //   @Res({ passthrough: true }) res: Response,
  // ) {
  //   // const svg = this.imagesService.generateAvatar(style, seed, options);
  //   const { contentType, body } = await this.imagesService.generateAvatar(
  //     style,
  //     options,
  //     format,
  //   );
  //   // Setting Last-Modified header is also good practice for caching
  //   res.setHeader('Content-Type', contentType);
  //   res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
  //   res.setHeader('Last-Modified', new Date().toUTCString());
  //   res.send(body);
  // }

  // This route handles requests WITHOUT a format, defaulting to SVG.
  // This replaces the old `/:format?` route.
  @Get(':style')
  @Header('Cache-Control', 'public, max-age=31536000')
  @ApiParam({ name: 'style', enum: DiceBearStyle })
  @ApiQuery({ name: 'seed', type: 'string', required: true })
  async getAvatarWithoutFormat(
    @Param('style', new ParseEnumPipe(DiceBearStyle)) style: DiceBearStyle,
    @Query() options: ImageOptionsDto,
    @Res() res: Response,
  ) {
    this.logger.log(
      `Generating avatar for style: ${style} with options: ${JSON.stringify(options)}`,
    );
    // Call the same shared method, explicitly passing SVG as the format.
    await this.sendAvatarResponse(style, ImageFormat.SVG, options, res);
  }

  // This route mirrors the official DiceBear API structure: /:style/:fomart
  // This route handles requests WITH a format specified (e.g., .png, .jpg)
  @Get(':style/:format')
  @Header('Cache-Control', 'public, max-age=31536000')
  @ApiParam({ name: 'style', enum: DiceBearStyle })
  @ApiParam({ name: 'format', enum: ImageFormat })
  @ApiQuery({ name: 'seed', type: 'string', required: true })
  async getAvatarWithFormat(
    @Param('style', new ParseEnumPipe(DiceBearStyle)) style: DiceBearStyle,
    @Param('format', new ParseEnumPipe(ImageFormat)) format: ImageFormat,
    @Query() options: ImageOptionsDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Delegate the core logic to a shared private method to avoid duplication.
    await this.sendAvatarResponse(style, format, options, res);
  }

  // **NEW**: Private helper method to handle the response generation.
  private async sendAvatarResponse(
    style: DiceBearStyle,
    format: ImageFormat,
    options: ImageOptionsDto,
    res: Response,
  ) {
    const { contentType, body } = await this.imagesService.generateAvatar(
      style,
      options,
      format,
    );

    // Setting Last-Modified header
    res.setHeader('Content-Type', contentType);
    res.setHeader('Last-Modified', new Date().toUTCString());
    res.send(body);
  }
}
