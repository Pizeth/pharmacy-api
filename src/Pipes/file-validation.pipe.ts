// src/pipes/file-validation.pipe.ts
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class FileValidationPipe implements PipeTransform {
  private readonly maxSize =
    Number(process.env.VIRUS_TOTAL_MAX_SIZE) || 32 * 1024 * 1024;
  private readonly allowedMimeTypes = process.env.R2_ALLOWED_MIME_TYPES
    ? process.env.R2_ALLOWED_MIME_TYPES.split(',').map((mime) => mime.trim())
    : [
        'image/jpg',
        'image/jpeg',
        'image/png',
        'application/pdf',
        'image/svg+xml',
      ];
  constructor(
    private readonly options: {
      maxSize?: number; // in bytes
      allowedMimeTypes?: string[];
    },
  ) {
    this.options.maxSize = this.options.maxSize || this.maxSize;
    this.options.allowedMimeTypes =
      this.options.allowedMimeTypes || this.allowedMimeTypes;
  }

  transform(file: Express.Multer.File) {
    if (!file) throw new BadRequestException('File is required');

    // File size validation
    if (this.options.maxSize && file.size > this.options.maxSize) {
      throw new BadRequestException(
        `File too large. Max size: ${this.options.maxSize / 1024 / 1024}MB`,
      );
    }

    // MIME type validation
    if (
      this.options.allowedMimeTypes &&
      !this.options.allowedMimeTypes.includes(file.mimetype)
    ) {
      throw new BadRequestException(
        `Invalid file type. Allowed types: ${this.options.allowedMimeTypes.join(', ')}`,
      );
    }

    return file;
  }
}
