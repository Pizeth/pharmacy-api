// src/pipes/file-validation.pipe.ts
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class FileValidationPipe implements PipeTransform {
  constructor(
    private readonly options: {
      maxSize?: number; // in bytes
      allowedMimeTypes?: string[];
    },
  ) {}

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
