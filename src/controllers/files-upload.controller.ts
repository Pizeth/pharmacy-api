import {
  Controller,
  Get,
  Header,
  Param,
  Post,
  UploadedFile,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { R2Service } from 'src/configs/cloudflare-r2.service';
import { LoggerService } from 'src/services/logger.service';
import { Readable } from 'stream';

@Controller('files')
export class FilesController {
  constructor(
    private readonly r2Service: R2Service,
    private readonly logger: LoggerService,
  ) {}
  @Post('upload')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    // ...
  }
  @Get(':filename')
  @Header('Cache-Control', 'public, max-age=604800, immutable') // 1 week caching
  async getFile(@Param('filename') filename: string): Promise<Readable> {
    try {
      return await this.r2Service.getFile(filename);
    } catch (error: unknown) {
      this.logger.error(
        `Error getting file '${filename}':`,
        JSON.stringify(error),
      );
      throw new Error(`Failed to retrieve file: ${filename}`);
    }
  }
}
