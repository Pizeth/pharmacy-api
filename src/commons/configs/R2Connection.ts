import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

// Define interfaces for return types
interface UploadResponse {
  status: number;
  message: string;
  fileName: string;
  url: string;
  error?: string;
}

interface DeleteResponse {
  status: number;
  message: string;
  fileName: string;
  error?: string;
}

@Injectable()
export class R2Service {
  private readonly logger = new Logger(R2Service.name);
  private readonly r2Client: S3Client;

  constructor(private configService: ConfigService) {
    // Configure R2 client
    this.r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${this.configService.get<string>('ACCOUNT_ID')}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.configService.get<string>('R2_ACCESS_KEY_ID')!,
        secretAccessKey: this.configService.get<string>(
          'R2_SECRET_ACCESS_KEY',
        )!,
      },
    });
  }

  async upload(
    fileName: string,
    buffer: Buffer,
    mimetype: string,
  ): Promise<UploadResponse> {
    try {
      // Create an upload command to R2
      const command = new PutObjectCommand({
        Bucket: this.configService.get<string>('R2_BUCKET_NAME')!,
        Key: fileName,
        Body: buffer,
        ContentType: mimetype,
      });

      // Send the upload command
      await this.r2Client.send(command);

      // Generate the public URL (if your bucket is public)
      const publicUrl = `${this.configService.get<string>('R2_PUBLIC_DOMAIN')}/${fileName}`;

      this.logger.log(`File uploaded successfully: ${fileName}`);

      // Return success metadata
      return {
        status: 200,
        message: 'File uploaded successfully',
        fileName,
        url: publicUrl,
      };
    } catch (error: any) {
      // Handle potential errors
      this.logger.error(`Error uploading file ${fileName}:`, error);
      return {
        status: error.statusCode || 500,
        message: error.message || 'Failed to upload file',
        fileName,
        url: '',
        error: error.toString(),
      };
    }
  }

  async deleteFile(fileName: string): Promise<DeleteResponse> {
    try {
      // Create a delete command
      const command = new DeleteObjectCommand({
        Bucket: this.configService.get<string>('R2_BUCKET_NAME')!,
        Key: fileName,
      });

      // Send the delete command
      await this.r2Client.send(command);

      this.logger.log(`File deleted successfully: ${fileName}`);

      // Return success metadata
      return {
        status: 200,
        message: 'File deleted successfully',
        fileName,
      };
    } catch (error: any) {
      // Handle potential errors
      this.logger.error(`Error deleting file ${fileName}:`, error);
      return {
        status: error.statusCode || 500,
        message: error.message || 'Failed to delete file',
        fileName,
        error: error.toString(),
      };
    }
  }

  // Optional: Method to check if file exists
  async fileExists(fileName: string): Promise<boolean> {
    try {
      const { HeadObjectCommand } = await import('@aws-sdk/client-s3');
      const command = new HeadObjectCommand({
        Bucket: this.configService.get<string>('R2_BUCKET_NAME')!,
        Key: fileName,
      });

      await this.r2Client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound') {
        return false;
      }
      this.logger.error(`Error checking file existence ${fileName}:`, error);
      throw error;
    }
  }
}
