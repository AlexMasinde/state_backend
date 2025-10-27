import { Controller, Post, Get, Body, Param, UseGuards, Request, BadRequestException, NotFoundException, ForbiddenException, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BulkUploadService } from './bulk-upload.service';
import { AtGuard } from '../auth/guards/at.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Logger } from '@nestjs/common';
import * as XLSX from 'xlsx';

@Controller('participants/bulk-upload')
@UseGuards(AtGuard, RolesGuard)
export class BulkUploadController {
  private readonly logger = new Logger(BulkUploadController.name);

  constructor(private bulkUploadService: BulkUploadService) {}

  @Post()
  @Roles('admin')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: any,
    @Body('eventId') eventId: string,
    @Body('columnMapping') columnMapping: string,
  ) {
    try {
      this.logger.log(`=== Bulk Upload Request Received ===`);
      this.logger.log(`File: ${file?.originalname || 'null'}, Size: ${file?.size || 0}`);
      this.logger.log(`Event ID: ${eventId}`);
      this.logger.log(`Column Mapping: ${columnMapping?.substring(0, 200)}...`);

      if (!file) {
        this.logger.warn('No file uploaded');
        throw new BadRequestException('No file uploaded');
      }

      if (!eventId) {
        this.logger.warn('Event ID is missing');
        throw new BadRequestException('Event ID is required');
      }

      // Parse column mapping
      let mapping;
      try {
        mapping = JSON.parse(columnMapping);
        this.logger.log('Column mapping parsed successfully');
      } catch (error) {
        this.logger.error('Failed to parse column mapping:', error);
        throw new BadRequestException('Invalid column mapping format');
      }

      // Validate required mappings
      if (!mapping.idNumberColumn || !mapping.nameColumn || !mapping.phoneNumberColumn || !mapping.groupColumn || !mapping.originColumn) {
        this.logger.warn('Missing required column mappings:', JSON.stringify(mapping));
        throw new BadRequestException('Missing required column mappings');
      }

      // Parse records from file
      this.logger.log('Parsing Excel file...');
      const records = await this.parseExcelFile(file.buffer);
      this.logger.log(`Parsed ${records.length} records from file`);

      this.logger.log('Creating bulk upload job...');
      const jobId = await this.bulkUploadService.createJobWithFileAndMapping(
        eventId,
        file.originalname,
        file.buffer,
        records,
        mapping
      );
      this.logger.log(`Job created successfully with ID: ${jobId}`);

      return { 
        jobId, 
        message: 'File uploaded and job created successfully',
        totalRecords: records.length,
        status: 'pending'
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        this.logger.warn('Bad request:', error.message);
        throw error;
      }
      this.logger.error('Failed to upload file:', error);
      this.logger.error('Error stack:', error.stack);
      this.logger.error('Error details:', {
        name: error?.name,
        message: error?.message,
        code: error?.code,
      });
      throw new Error('Failed to upload file');
    }
  }

  @Get('progress/:jobId')
  @Roles('admin')
  async getProgress(
    @Param('jobId') jobId: string,
  ) {
    try {
      const job = await this.bulkUploadService.getJobProgress(jobId);
      
      if (!job) {
        throw new NotFoundException('Job not found');
      }

      return {
        jobId: job.id,
        fileName: job.fileName,
        totalRecords: job.totalRecords,
        processedRecords: job.processedRecords,
        voterLookupsCompleted: job.voterLookupsCompleted,
        voterLookupsFailed: job.voterLookupsFailed,
        recordsPending: job.recordsPending,
        status: job.status,
        progress: job.totalRecords > 0 ? (job.processedRecords / job.totalRecords) * 100 : 0,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        error: job.errorMessage,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Failed to get job progress:', error);
      throw new Error('Failed to get job progress');
    }
  }

  @Get('event/:eventId/jobs')
  @Roles('admin')
  async getEventJobs(
    @Param('eventId') eventId: string,
  ) {
    try {
      const jobs = await this.bulkUploadService.getEventJobs(eventId);
      
      return jobs.map(job => ({
        id: job.id,
        jobId: job.id,
        fileName: job.fileName,
        totalRecords: job.totalRecords,
        processedRecords: job.processedRecords,
        status: job.status,
        progress: job.totalRecords > 0 ? (job.processedRecords / job.totalRecords) * 100 : 0,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
      }));
    } catch (error) {
      this.logger.error('Failed to get event jobs:', error);
      throw new Error('Failed to get event jobs');
    }
  }

  @Post(':jobId/retry')
  @Roles('admin')
  async retryJob(
    @Param('jobId') jobId: string,
  ) {
    try {
      const retriedJob = await this.bulkUploadService.retryFailedJob(jobId);
      
      return {
        success: true,
        job: {
          id: retriedJob.id,
          status: retriedJob.status,
          retryCount: retriedJob.retryCount,
        },
        message: 'Job retried successfully'
      };
    } catch (error) {
      this.logger.error('Failed to retry job:', error);
      throw new Error(error.message || 'Failed to retry job');
    }
  }

  // Helper method to parse Excel file
  private async parseExcelFile(fileBuffer: Buffer): Promise<any[]> {
    try {
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (jsonData.length < 2) {
        throw new BadRequestException('Excel file must have at least a header row and one data row');
      }
      
      // Get headers and data rows
      const headers = jsonData[0] as string[];
      const dataRows = jsonData.slice(1) as any[][];
      
      // Convert to objects
      const records = dataRows.map(row => {
        const record: any = {};
        headers.forEach((header, index) => {
          record[header] = row[index] || '';
        });
        return record;
      });
      
      return records;
    } catch (error) {
      throw new BadRequestException('Failed to parse Excel file: ' + error.message);
    }
  }
}
