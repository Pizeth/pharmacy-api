// src/pipes/file-validation.pipe.ts
import {
  PipeTransform,
  Injectable,
  BadRequestException,
  ArgumentMetadata,
  Logger,
} from '@nestjs/common';
import type { FileValidationOptions } from 'src/types/file';

@Injectable()
export class FileValidationPipe implements PipeTransform {
  // private readonly maxSize =
  //   Number(process.env.VIRUS_TOTAL_MAX_SIZE) || 32 * 1024 * 1024;
  // private readonly allowedMimeTypes = process.env.R2_ALLOWED_MIME_TYPES
  //   ? process.env.R2_ALLOWED_MIME_TYPES.split(',').map((mime) => mime.trim())
  //   : [
  //       'image/jpg',
  //       'image/jpeg',
  //       'image/png',
  //       'application/pdf',
  //       'image/svg+xml',
  //     ];
  // constructor(
  //   private readonly options: {
  //     maxSize?: number; // in bytes
  //     allowedMimeTypes?: string[];
  //   },
  // ) {
  //   this.options.maxSize = this.options.maxSize || this.maxSize;
  //   this.options.allowedMimeTypes =
  //     this.options.allowedMimeTypes || this.allowedMimeTypes;
  // }
  private readonly logger = new Logger(FileValidationPipe.name);
  constructor(
    private readonly options: FileValidationOptions = {},
    // We pass options directly to the transform method now
  ) {}

  transform(file: Express.Multer.File, metadata: ArgumentMetadata) {
    const { fileIsRequired = true } = this.options;

    this.logger.debug('metadata:', metadata);

    if (!file) {
      if (fileIsRequired) {
        throw new BadRequestException('File is required');
      }
      // If the file is not required and doesn't exist, we can just return.
      // The parameter in the controller should be optional (e.g., avatarFile?: ...).
      return file;
    }

    // Get validation values from config, with defaults
    // const maxSize =
    //   this.options.maxSize ||
    //   this.configService.get<number>('VIRUS_TOTAL_MAX_SIZE', 32 * 1024 * 1024);
    // const allowedMimeTypes =
    //   this.options.allowedMimeTypes ||
    //   this.configService.get<string[]>('R2_ALLOWED_MIME_TYPES', [
    //     'image/jpg',
    //     'image/jpeg',
    //     'image/png',
    //     'application/pdf',
    //     'image/svg+xml',
    //   ]);

    // Get validation values from options, falling back to environment variables or sane defaults.
    const maxSize =
      this.options.maxSize ||
      Number(process.env.VIRUSTOTAL_MAX_SIZE) ||
      32 * 1024 * 1024;
    const allowedMimeTypes = this.options.allowedMimeTypes ||
      process.env.R2_ALLOWED_MIME_TYPES?.split(',') || [
        'image/jpg',
        'image/jpeg',
        'image/png',
        'application/pdf',
        'image/svg+xml',
      ];

    // File size validation
    if (file.size > maxSize) {
      throw new BadRequestException(
        `File too large. Max size: ${maxSize / 1024 / 1024}MB`,
      );
    }

    // MIME type validation
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`,
      );
    }

    return file;
  }

  // transform(file: Express.Multer.File) {
  //   if (!file) throw new BadRequestException('File is required');

  //   // File size validation
  //   if (this.options.maxSize && file.size > this.options.maxSize) {
  //     throw new BadRequestException(
  //       `File too large. Max size: ${this.options.maxSize / 1024 / 1024}MB`,
  //     );
  //   }

  //   // MIME type validation
  //   if (
  //     this.options.allowedMimeTypes &&
  //     !this.options.allowedMimeTypes.includes(file.mimetype)
  //   ) {
  //     throw new BadRequestException(
  //       `Invalid file type. Allowed types: ${this.options.allowedMimeTypes.join(', ')}`,
  //     );
  //   }

  //   return file;
  // }
}
