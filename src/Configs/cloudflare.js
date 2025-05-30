import { config } from 'dotenv';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

config();

// Configure R2 client
export const R2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

export const upload = async (fileName, buffer, mimetype) => {
  try {
    // Create an ppload command to R2
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileName,
      Body: buffer,
      ContentType: mimetype,
    });

    // Send the upload command
    await R2.send(command);

    // Generate the public URL (if your bucket is public)
    const publicUrl = `${process.env.R2_PUBLIC_DOMAIN}/${fileName}`;

    // Return success metadata
    return {
      status: 200,
      message: 'File uploaded successfully',
      fileName,
      url: publicUrl,
    };
  } catch (error) {
    // Handle potential errors
    console.error('Error uploading file:', error);
    return {
      status: error.statusCode || 500,
      message: error.message || 'Failed to upload file',
      fileName,
      url: '',
      error: error.toString(),
    };
  }
};

export const deleteFile = async (fileName) => {
  try {
    // Create a delete command
    const command = new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileName,
    });

    // Send the delete command
    await R2.send(command);

    // Return success metadata
    return {
      status: 200,
      message: 'File deleted successfully',
      fileName,
    };
  } catch (error) {
    // Handle potential errors
    console.error('Error deleting file:', error);
    return {
      status: error.statusCode || 500,
      message: error.message || 'Failed to delete file',
      fileName,
      error: error.toString(),
    };
  }
};

export default { R2, upload, deleteFile };
