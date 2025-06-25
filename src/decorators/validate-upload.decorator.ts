// -----------------------------------------------------------------
// Create a Custom Decorator for File Uploads
// Location: src/decorators/validate-upload.decorator.ts
// -----------------------------------------------------------------
// This decorator makes your controller super clean.

import { UploadedFile } from '@nestjs/common';
import { FileValidationPipe } from '../pipes/file-validation.pipe'; // Adjust path
import { FileValidationOptions } from 'src/types/file';

export const ValidateFile = (
  options: FileValidationOptions = {}, // Default to empty object
) => {
  // This decorator simply returns the result of @UploadedFile with our custom pipe.
  // It is now a pure ParameterDecorator.
  return UploadedFile(new FileValidationPipe(options));
};
