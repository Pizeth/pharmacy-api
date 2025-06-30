import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config'; // For environment variables
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  PutObjectCommandInput,
  DeleteObjectCommandInput,
  S3ServiceException,
  HeadObjectCommand,
  GetObjectCommand, // To type AWS SDK errors
} from '@aws-sdk/client-s3';
import { Readable } from 'stream'; // For buffer/stream handling
import {
  R2UploadResponse,
  R2DeleteResponse,
  R2ErrorResponse,
  R2DeleteSuccessResponse,
  R2UploadSuccessResponse,
  // HttpErrorStatusEnum,
} from 'src/types/types';
import { VirusScanService } from 'src/commons/services/virus-scan.service';
// import { LoggerService } from 'src/commons/services/logger.service';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AppError } from 'src/exceptions/app.exception';
import { type } from 'src/types/commons.enum';

@Injectable()
export class R2Service implements OnModuleInit {
  private readonly logger = new Logger(R2Service.name);
  private readonly MAX_FILE_SIZE =
    Number(process.env.VIRUS_TOTAL_MAX_SIZE) || 32 * 1024 * 1024; // 32MB, adjust as needed
  private readonly EXPIRE_IN_SECONDS =
    Number(process.env.R2_EXPIRE_IN_SECONDS) || 3600; // Default to 1 hour if not set
  private r2Client!: S3Client;
  private accountId: string;
  private accessKeyId: string;
  private secretAccessKey: string;
  private bucketName: string;
  private publicDomain: string;
  private endPoint: string;

  constructor(
    private configService: ConfigService,
    private readonly virusScanService: VirusScanService,
    // private readonly logger: LoggerService,
  ) {
    // Load R2 configuration using a helper for required values
    this.accountId = this.getRequiredConfig('R2_ACCOUNT_ID');
    this.accessKeyId = this.getRequiredConfig('R2_ACCESS_KEY_ID');
    this.secretAccessKey = this.getRequiredConfig('R2_SECRET_ACCESS_KEY');
    this.bucketName = this.getRequiredConfig('R2_BUCKET_NAME');
    this.publicDomain = this.getRequiredConfig('R2_PUBLIC_DOMAIN');
    this.endPoint = `https://${this.accountId}.r2.cloudflarestorage.com`;
  }

  /**
   * Helper function to get required configuration values and throw if missing.
   * @param key The environment variable key.
   * @returns The configuration value as a string.
   * @throws Error if the key is not found or is empty.
   */
  private getRequiredConfig(key: string): string {
    const value = this.configService.get<string>(key);
    if (!value) {
      this.logger.error(
        `Required R2 configuration key '${key}' is missing or empty.`,
        R2Service.name,
      );
      throw new Error(
        `Required R2 configuration key '${key}' is missing or empty.`,
      );
    }
    return value;
  }

  onModuleInit() {
    // Initialize S3Client for R2
    this.r2Client = new S3Client({
      region: 'auto',
      endpoint: this.endPoint,
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      },
    });
    this.logger.log('R2Service initialized and S3Client configured.');
  }

  /**
   * Helper to determine if an error is an S3ServiceException.
   * This is a type guard.
   */
  private isS3ServiceException(error: unknown): error is S3ServiceException {
    return (
      typeof error === 'object' &&
      error !== null &&
      '$metadata' in error &&
      'name' in error &&
      'message' in error
    );
  }

  // Type guards for better runtime type checking
  private isR2UploadSuccess(
    response: R2UploadResponse,
  ): response is R2UploadSuccessResponse {
    return Number(response.status) === Number(HttpStatus.CREATED); // 201
  }

  private isR2DeleteSuccess(
    response: R2DeleteResponse,
  ): response is R2DeleteSuccessResponse {
    return response.status === HttpStatus.OK; // 200
  }

  private isR2Error(
    response: R2UploadResponse | R2DeleteResponse | R2ErrorResponse,
  ): response is R2ErrorResponse {
    return (
      response.status !== HttpStatus.OK &&
      response.status !== HttpStatus.CREATED
    );
  }

  //   async uploadFiles(file: Express.Multer.File): Promise<R2UploadResponse> {
  //     if (
  //       file.size > 300 &&
  //       file.buffer instanceof Buffer &&
  //       file.buffer.length > 300
  //     ) {
  //       return {
  //         status: 413,
  //         message: `File size exceeds maximum allowed size of ${file} bytes`,
  //         fileName: file.filename,
  //         url: '',
  //         error: 'File too large',
  //       };
  //     }

  //     try {
  //       const params: PutObjectCommandInput = {
  //         Bucket: this.bucketName,
  //         Key: file.originalname,
  //         Body: file.buffer,
  //         ContentType: file.mimetype,
  //         // You can add ACL or other parameters if needed, e.g., ACL: 'public-read'
  //         // For Cloudflare R2, public access is typically managed at the bucket level or via signed URLs.
  //       };

  //       const command = new PutObjectCommand(params);
  //       await this.r2Client.send(command);

  //       const publicUrl = `${this.publicDomain}/${fileName}`;
  //       this.logger.log(
  //         `File uploaded successfully: ${fileName}, URL: ${publicUrl}`,
  //       );

  //       return {
  //         status: 200,
  //         message: 'File uploaded successfully',
  //         fileName,
  //         url: publicUrl,
  //       };
  //     } catch (error) {
  //       this.logger.error(`Error uploading file '${fileName}':`, error);
  //       const s3Error = error as S3ServiceException; // Type assertion for AWS SDK errors
  //       let errorMessage = 'An unexpected error occurred during upload.'; // Or 'deletion'
  //       if (s3Error?.message) {
  //         errorMessage = s3Error.message;
  //       } else if (error instanceof Error && error.message) {
  //         errorMessage = error.message;
  //       } else if (typeof error === 'string') {
  //         errorMessage = error;
  //       }
  //       return {
  //         status: s3Error?.$metadata?.httpStatusCode || 500,
  //         message: s3Error?.message || 'Failed to upload file',
  //         fileName,
  //         url: '',
  //         error: `[${s3Error?.name || 'UploadError'}] ${errorMessage}`,
  //       };
  //     }
  //   }

  async getSignedUrl(
    filename: string,
    expiresIn: number = this.EXPIRE_IN_SECONDS, // Default to 1 hour
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: filename,
    });

    return await getSignedUrl(this.r2Client, command, { expiresIn });
  }

  async getFile(key: string): Promise<Readable> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.r2Client.send(command);
      // The response.Body is a Readable stream
      const stream = response.Body as Readable;
      return stream;
    } catch (error: unknown) {
      this.logger.error(`Error getting file '${key}':`, JSON.stringify(error));
      throw new Error(`Error getting file '${key}' from Cloudflare R2`);
    }
  }

  /**
   * Uploads a file to Cloudflare R2.
   * @param fileName The name of the file to be stored in R2.
   * @param buffer The file content as a Buffer or Readable stream.
   * @param mimetype The MIME type of the file.
   * @returns A promise resolving to an R2UploadResponse.
   */

  async uploadFile(
    file: Express.Multer.File,
    fileName?: string,
    // buffer: Buffer | Readable,
    // mimetype: string,
    // maxSizeBytes: number = this.MAX_FILE_SIZE,
    // correlationId: string,
  ): Promise<R2UploadResponse> {
    // Validate file
    if (!file)
      throw new AppError(
        'No file provided',
        HttpStatus.BAD_REQUEST,
        R2Service.name,
        {
          message: 'Call upload service with empty file',
          fileName,
          error: 'No file provided',
        },
      );

    fileName = fileName || file.originalname;

    this.logger.log(`Starting upload for: ${fileName}`, 'R2Service', fileName);
    // if (
    //   maxSizeBytes &&
    //   buffer instanceof Buffer &&
    //   buffer.length > maxSizeBytes
    // ) {
    //   return {
    //     status: statusCodes.REQUEST_TOO_LONG, // 413
    //     message: `File size exceeds maximum allowed size of ${maxSizeBytes} bytes`,
    //     fileName,
    //     url: '',
    //     error: 'File too large',
    //   };
    // }

    // File size validation (32MB limit for VirusTotal free tier)
    if (file.size > this.MAX_FILE_SIZE) {
      return {
        type: type.Error,
        status: HttpStatus.PAYLOAD_TOO_LARGE, // 413,
        message:
          'File size exceeds maximum allowed size of ${maxSizeBytes} bytes',
        fileName: fileName,
        error: `Max size: ${this.MAX_FILE_SIZE}MB`,
      };
    }

    // Virus scanning with VirusTotal
    const isClean = await this.virusScanService.scanBuffer(file.buffer);
    // if (!isClean) throw new Error('File contains malware');

    if (!isClean) {
      return {
        type: type.Error,
        status: HttpStatus.UNPROCESSABLE_ENTITY, // 422
        message: 'File contains potential malware',
        fileName: fileName,
        error: `Malicious content detected in the file ${fileName}`,
      };
    }

    // Upload logic
    // const fileName = this.generateFileName(file.originalname);
    // await this.r2Client.send(
    //   new PutObjectCommand({
    //     Bucket: this.configService.get('R2_BUCKET_NAME'),
    //     Key: fileName,
    //     Body: file.buffer,
    //     ContentType: file.mimetype,
    //   }),
    // );

    // return {
    //   status: 200,
    //   message: 'File uploaded successfully',
    //   fileName,
    //   url: `${this.configService.get('R2_PUBLIC_URL')}/${fileName}`,
    // };

    try {
      const params: PutObjectCommandInput = {
        Bucket: this.bucketName,
        Key: fileName,
        Body: file.buffer, // Use file.buffer directly
        ContentType: file.mimetype, // Use file.mimetype directly
        // You can add ACL or other parameters if needed, e.g., ACL: 'public-read'
        // For Cloudflare R2, public access is typically managed at the bucket level or via signed URLs.
      };

      const command = new PutObjectCommand(params);
      await this.r2Client.send(command);

      const publicUrl = `${this.publicDomain}/${fileName}`;
      this.logger.log(
        `File uploaded successfully: ${fileName}, URL: ${publicUrl}`,
      );

      return {
        type: type.Upload,
        status: HttpStatus.CREATED, // 201
        message: 'File uploaded successfully',
        fileName: fileName || file.originalname,
        url: publicUrl,
      };
    } catch (error: unknown) {
      // this.logger.error(`Upload failed: ${error.message}`);
      // return {
      //   status: 500,
      //   message: 'File upload failed',
      //   fileName: file?.originalname || 'unknown',
      //   error: error.message,
      // };
      // this.logger.error(
      //   `Upload failed for ${file.originalname}: ${error.message}`,
      //   error.stack,
      //   'R2Service',
      //   correlationId,
      // );
      // throw error;
      this.logger.error(
        `Error uploading file '${fileName}':`,
        JSON.stringify(error),
      );
      const s3Error = error as S3ServiceException; // Type assertion for AWS SDK errors
      let errorMessage = 'An unexpected error occurred during upload.'; // Or 'deletion'
      if (s3Error?.message) {
        errorMessage = s3Error.message;
      } else if (error instanceof Error && error.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      return {
        type: type.Error,
        status:
          s3Error?.$metadata?.httpStatusCode ||
          HttpStatus.INTERNAL_SERVER_ERROR, // 500
        message: s3Error?.message || 'Failed to upload file',
        fileName,
        url: '',
        error: `[${s3Error?.name || 'UploadError'}] ${errorMessage}`,
      };
    }
  }

  /**
   * Deletes a file from Cloudflare R2.
   * @param fileName The name of the file to be deleted from R2.
   * @returns A promise resolving to an R2DeleteResponse.
   */
  async deleteFile(fileName: string): Promise<R2DeleteResponse> {
    try {
      const params: DeleteObjectCommandInput = {
        Bucket: this.bucketName,
        Key: fileName,
      };

      const command = new DeleteObjectCommand(params);
      await this.r2Client.send(command);

      this.logger.log(`File deleted successfully: ${fileName}`);
      return {
        type: type.Delete,
        status: 200,
        message: 'File deleted successfully',
        fileName,
      };
    } catch (error: unknown) {
      this.logger.error(
        `Error deleting file '${fileName}':`,
        JSON.stringify(error),
      );
      const s3Error = error as S3ServiceException;
      let errorMessage = 'An unexpected error occurred during upload.'; // Or 'deletion'
      if (s3Error?.message) {
        errorMessage = s3Error.message;
      } else if (error instanceof Error && error.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      return {
        type: type.Error,
        status: s3Error?.$metadata?.httpStatusCode || 500,
        message: s3Error?.message || 'Failed to delete file',
        fileName,
        error: `[${s3Error?.name || 'DeleteError'}] ${errorMessage}`,
      };
    }
  }

  /**
   * Checks if a file exists in Cloudflare R2.
   * @param fileName The name of the file to check.
   * @returns A promise resolving to a boolean indicating existence.
   */
  async fileExists(fileName: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: fileName,
      });

      await this.r2Client.send(command);
      return true; // If send() doesn't throw, the object exists.
    } catch (err: unknown) {
      // Catch error as unknown
      // AWS SDK v3 throws an error (often with 'NotFound' name or code) if not found.
      if (this.isS3ServiceException(err)) {
        if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
          return false;
        }
      } else if (err instanceof Error && err.name === 'NotFound') {
        // Some generic errors might also have a 'NotFound' name
        return false;
      }
      // Re-throw other unexpected errors or log them as appropriate
      this.logger.error(
        `Error checking file existence for '${fileName}':`,
        JSON.stringify(err),
      );
      // Depending on desired behavior, you might re-throw or return false for other errors too.
      // For now, re-throwing for truly unexpected issues.
      throw err;
    }
  }
  /**
   * Provides access to the S3 client if needed for more advanced operations.
   * @returns The configured S3Client instance.
   */
  getClient(): S3Client {
    return this.r2Client;
  }
}

//   // Optional: Method to check if file exists
//   async fileExists(fileName: string): Promise<boolean> {
//     try {
//       const { HeadObjectCommand } = await import('@aws-sdk/client-s3');
//       const command = new HeadObjectCommand({
//         Bucket: this.configService.get<string>('R2_BUCKET_NAME')!,
//         Key: fileName,
//       });

//       await this.r2Client.send(command);
//       return true;
//     } catch (error: any) {
//       if (error.name === 'NotFound') {
//         return false;
//       }
//       this.logger.error(`Error checking file existence ${fileName}:`, error);
//       throw error;
//     }
//   }

// To use this service:
// 1. Ensure you have @nestjs/config installed and configured.
//    Your .env file should have:
//    R2_ACCOUNT_ID=your_cloudflare_account_id
//    R2_ACCESS_KEY_ID=your_r2_access_key_id
//    R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
//    R2_BUCKET_NAME=your_r2_bucket_name
//    R2_PUBLIC_DOMAIN=https://your_r2_public_bucket_domain (e.g., https://pub-xxxxxxxx.r2.dev)

// 2. Provide R2Service in a NestJS module:
//    import { Module } from '@nestjs/common';
//    import { ConfigModule } from '@nestjs/config';
//    import { R2Service } from './r2.service';
//
//    @Module({
//      imports: [ConfigModule.forRoot({ isGlobal: true })], // Ensure ConfigModule is available
//      providers: [R2Service],
//      exports: [R2Service],
//    })
//    export class R2Module {} // Or add to an existing module

// 3. Inject and use R2Service in other services or controllers:
//    import { Controller, Post, UploadedFile, UseInterceptors, Param, Delete } from '@nestjs/common';
//    import { FileInterceptor } from '@nestjs/platform-express';
//    import { R2Service } from './r2.service';
//
//    @Controller('files')
//    export class FilesController {
//      constructor(private readonly r2Service: R2Service) {}
//
//      @Post('upload')
//      @UseInterceptors(FileInterceptor('file')) // 'file' is the field name in form-data
//      async upload(@UploadedFile() file: Express.Multer.File) {
//        if (!file) {
//          return { status: 400, message: 'No file uploaded.' };
//        }
//        // Generate a unique file name, e.g., using UUID or timestamp
//        const uniqueFileName = `${Date.now()}-${file.originalname}`;
//        return this.r2Service.uploadFile(uniqueFileName, file.buffer, file.mimetype);
//      }
//
//      @Delete(':fileName')
//      async remove(@Param('fileName') fileName: string) {
//        return this.r2Service.deleteFile(fileName);
//      }
//    }
