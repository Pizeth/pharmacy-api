// Options that can be passed to the pipe
export interface FileValidationOptions {
  maxSize?: number; // in bytes
  allowedMimeTypes?: string[];
  fileIsRequired?: boolean;
}
