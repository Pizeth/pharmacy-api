import {
  Body,
  Controller,
  Get,
  Header,
  Logger,
  Param,
  Post,
  // UnauthorizedException,
  UploadedFile,
  // UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
// import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { R2Service } from 'src/modules/files/services/cloudflare-r2.service';
// import { TokenService } from 'src/commons/services/token.service';
import { Readable } from 'stream';

@Controller('files')
export class FilesController {
  private readonly logger = new Logger(FilesController.name);
  constructor(
    private readonly r2Service: R2Service,
    // private readonly logger: LoggerService,
    // private readonly tokenService: TokenService, // Assuming this is the correct service for token generation
  ) {}
  @Post('upload')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  // @UseGuards(JwtAuthGuard)
  // @Roles('admin', 'uploader') // Custom decorator
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

  // @Post('generate-token')
  // generateToken(@Body() body: { filename: string }) {
  //   return this.tokenService.generateToken({
  //     filename: body.filename,
  //   });
  // }

  // @Get('secure/:token')
  // async getSecureFile(@Param('token') token: string) {
  //   try {
  //     const filename = this.tokenService.verifyToken(token);
  //     return this.r2Service.getFile(filename.username);
  //   } catch (e: unknown) {
  //     throw new UnauthorizedException('Invalid access token');
  //   }
  // }
}
