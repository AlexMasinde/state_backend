import { Injectable, Logger } from '@nestjs/common';
import * as AWS from 'aws-sdk';

@Injectable()
export class SpacesService {
  private readonly logger = new Logger(SpacesService.name);
  private s3: AWS.S3;

  constructor() {
    this.s3 = new AWS.S3({
      endpoint: process.env.SPACES_ENDPOINT,
      region: process.env.SPACES_REGION,
      accessKeyId: process.env.SPACES_ACCESS_KEY,
      secretAccessKey: process.env.SPACES_SECRET_KEY,
      s3ForcePathStyle: false,
    });
    
    if (!process.env.SPACES_ENDPOINT) {
      this.logger.warn('⚠️ Spaces service configuration missing. File uploads will fail.');
    } else {
      this.logger.log('✅ Spaces service configured successfully');
    }
  }

  async uploadFile(
    fileName: string,
    fileBuffer: Buffer,
    contentType?: string,
  ): Promise<string> {
    try {
      const params = {
        Bucket: process.env.SPACES_BUCKET_NAME,
        Key: fileName,
        Body: fileBuffer,
        ContentType: contentType || 'application/octet-stream',
        ACL: 'private',
      };

      const result = await this.s3.upload(params).promise();
      this.logger.log(`File uploaded successfully: ${fileName}`);
      return result.Location;
    } catch (error) {
      this.logger.error(`Failed to upload file ${fileName}:`, error);
      throw error;
    }
  }

  async downloadFile(fileName: string): Promise<Buffer> {
    try {
      const params = {
        Bucket: process.env.SPACES_BUCKET_NAME,
        Key: fileName,
      };

      const result = await this.s3.getObject(params).promise();
      this.logger.log(`File downloaded successfully: ${fileName}`);
      return result.Body as Buffer;
    } catch (error) {
      this.logger.error(`Failed to download file ${fileName}:`, error);
      throw error;
    }
  }

  async fileExists(fileName: string): Promise<boolean> {
    try {
      const params = {
        Bucket: process.env.SPACES_BUCKET_NAME,
        Key: fileName,
      };

      await this.s3.headObject(params).promise();
      return true;
    } catch (error: any) {
      if (error.statusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  async deleteFile(fileName: string): Promise<void> {
    try {
      const params = {
        Bucket: process.env.SPACES_BUCKET_NAME,
        Key: fileName,
      };

      await this.s3.deleteObject(params).promise();
      this.logger.log(`File deleted successfully: ${fileName}`);
    } catch (error) {
      this.logger.error(`Failed to delete file ${fileName}:`, error);
      throw error;
    }
  }
}
