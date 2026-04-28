import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import { BulkUploadJob } from './bulk-upload-job.entity';
import { BulkUploadRecord } from './entities/bulk-upload-record.entity';
import { EventService } from '../event/event.service';
import { ParticipantsService } from '../participants/participants.service';
import { SpacesService } from '../spaces/spaces.service';
import { VoterService } from '../voter/voter.service';
import * as XLSX from 'xlsx';
import { CreateParticipantDto } from '../participants/dto/create-participant.dto';

@Injectable()
export class BulkUploadService {
  private readonly logger = new Logger(BulkUploadService.name);
  private readonly maxConcurrentJobs = 2;
  private readonly activeJobs = new Set<string>();
  private pollInterval: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(BulkUploadJob)
    private jobRepository: Repository<BulkUploadJob>,
    @InjectRepository(BulkUploadRecord)
    private recordRepository: Repository<BulkUploadRecord>,
    private eventService: EventService,
    private participantsService: ParticipantsService,
    private spacesService: SpacesService,
    private voterService: VoterService,
  ) {
    this.startBackgroundProcessor();
  }

  onModuleDestroy() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.logger.log('Background job processor stopped');
    }
  }

  // Create job with file upload and column mapping (Streaming Version)
  async createJobWithFileAndMapping(
    eventId: string,
    fileName: string,
    fileBuffer: Buffer,
    records: any[],
    columnMapping: any,
  ): Promise<string> {
    try {
      this.logger.log(`=== Creating Job with File Upload ===`);
      this.logger.log(`Event ID: ${eventId}`);
      this.logger.log(`File Name: ${fileName}`);
      this.logger.log(`File Buffer Size: ${fileBuffer?.length || 0}`);
      this.logger.log(`Records Count: ${records?.length || 0}`);

      // Upload original file to Spaces (statehouse-specific prefix)
      this.logger.log('Uploading file to Spaces...');
      const originalFileName = `state_uploads/job_${Date.now()}_${fileName}`;
      const originalFileUrl = await this.spacesService.uploadFile(
        originalFileName,
        fileBuffer,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      this.logger.log(`File uploaded to Spaces: ${originalFileUrl}`);

      // Create job record
      this.logger.log('Creating job record in database...');
      const job = this.jobRepository.create({
        eventId,
        fileName,
        columnMapping: JSON.stringify(columnMapping),
        originalFileUrl,
        totalRecords: records.length,
        recordsPending: records.length,
        status: 'pending'
      });

      const savedJob = await this.jobRepository.save(job);
      this.logger.log(`Job saved with ID: ${savedJob.id}`);
      
      // Create individual record entries for streaming processing
      this.logger.log(`Creating ${records.length} record entities...`);
      const recordEntities = records.map((record, index) => 
        this.recordRepository.create({
          jobId: savedJob.id,
          rowIndex: index,
          recordData: record,
          status: 'pending'
        })
      );

      await this.recordRepository.save(recordEntities);
      this.logger.log(`Saved ${recordEntities.length} record entities`);
      
      this.logger.log(`Created streaming bulk upload job ${savedJob.id} with file upload and column mapping for event ${eventId}`);
      
      return savedJob.id;
    } catch (error) {
      this.logger.error(`Failed to create job with file upload:`, error);
      this.logger.error('Error stack:', error.stack);
      this.logger.error('Error details:', {
        name: error?.name,
        message: error?.message,
        code: error?.code,
      });
      throw error;
    }
  }

  // Background processor
  private async startBackgroundProcessor() {
    this.logger.log('Starting background job processor with 30-second polling');
    
    const pollInterval = setInterval(async () => {
      try {
        if (this.activeJobs.size < this.maxConcurrentJobs) {
          await this.processAvailableJobs();
        }
      } catch (error) {
        this.logger.error('Error in background processor:', error);
      }
    }, 30000); // 30 seconds
    
    this.pollInterval = pollInterval;
  }

  // Process available jobs
  private async processAvailableJobs() {
    const pendingJobs = await this.jobRepository.find({
      where: { status: 'pending' },
      order: { createdAt: 'ASC' },
      take: this.maxConcurrentJobs
    });

    if (pendingJobs.length === 0) return;

    const processingPromises = pendingJobs.map(job => this.processJob(job));
    await Promise.allSettled(processingPromises);
  }

  // Process individual job
  private async processJob(job: BulkUploadJob) {
    if (this.activeJobs.has(job.id)) return;
    
    this.activeJobs.add(job.id);
    this.logger.log(`Starting job ${job.id} for event ${job.eventId}`);

    try {
      await this.updateJobStatus(job.id, 'processing');
      await this.processJobWithVoterLookups(job);
      await this.updateJobStatus(job.id, 'completed');
      this.logger.log(`Job ${job.id} completed successfully`);
    } catch (error) {
      this.logger.error(`Job ${job.id} failed:`, error);
      await this.updateJobStatus(job.id, 'failed', error.message);
    } finally {
      this.activeJobs.delete(job.id);
    }
  }

  // Process job with voter lookups (batched)
  private async processJobWithVoterLookups(job: BulkUploadJob) {
    const columnMapping = job.columnMapping ? JSON.parse(job.columnMapping) : null;
    
    try {
      // Get all pending records for this job
      const pendingRecords = await this.recordRepository.find({
        where: { jobId: job.id, status: 'pending' },
        order: { rowIndex: 'ASC' }
      });

      this.logger.log(`🚀 Processing ${pendingRecords.length} records for job ${job.id} in batches of 1000`);

      const batchSize = 1000;
      for (let i = 0; i < pendingRecords.length; i += batchSize) {
        const batch = pendingRecords.slice(i, i + batchSize);
        
        try {
          // 1. Prepare DTOs and IDs for this batch
          const batchDtos: CreateParticipantDto[] = [];
          const batchIds: string[] = [];
          
          for (const record of batch) {
            const idNumber = columnMapping ? 
              record.recordData[columnMapping.idNumberColumn] : 
              record.recordData.idNumber;
            const normalizedId = String(idNumber).trim();
            
            const dto: CreateParticipantDto = {
              name: columnMapping ? record.recordData[columnMapping.nameColumn] : record.recordData.name,
              idNumber: normalizedId,
              phoneNumber: columnMapping ? record.recordData[columnMapping.phoneNumberColumn] : record.recordData.phoneNumber,
              group: columnMapping ? record.recordData[columnMapping.groupColumn] : record.recordData.group,
              origin: columnMapping ? record.recordData[columnMapping.originColumn] : record.recordData.origin,
              eventId: job.eventId
            };
            
            batchDtos.push(dto);
            batchIds.push(normalizedId);
            
            // Mark record as processing
            await this.recordRepository.update(record.id, { status: 'processing' });
          }
          
          // 2. Fetch Enrichment Data in Bulk (Parallel Voter/Adult lookup)
          const enrichmentData = await this.voterService.checkBulkRegistration(batchIds);
          
          // 3. Create/Update Participants in Bulk
          await this.participantsService.bulkCreateOrUpdate(batchDtos, enrichmentData);
          
          // 4. Update Records as Completed
          for (const record of batch) {
            const idNumber = columnMapping ? 
              record.recordData[columnMapping.idNumberColumn] : 
              record.recordData.idNumber;
            const normalizedId = String(idNumber).trim();
            const enrichment = enrichmentData.get(normalizedId);
            
            await this.recordRepository.update(record.id, { 
              status: 'completed',
              voterData: enrichment ? JSON.stringify(enrichment) : null,
              processedAt: new Date()
            });
          }
          
          // 5. Update Job Progress
          await this.updateJobProgressFromRecords(job.id);
          this.logger.log(`✅ Batch ${Math.floor(i/batchSize) + 1} complete (${Math.min(i + batchSize, pendingRecords.length)}/${pendingRecords.length})`);

        } catch (error) {
          this.logger.error(`❌ Batch starting at index ${i} failed:`, error);
          // Mark batch as failed
          for (const record of batch) {
            await this.recordRepository.update(record.id, { 
              status: 'failed',
              errorMessage: error.message,
              processedAt: new Date()
            });
          }
        }
      }
      // Mark job as completed
      await this.updateJobStatus(job.id, 'completed');
      
    } catch (error) {
      this.logger.error(`Job ${job.id} processing failed:`, error);
      throw error;
    }
  }

  // Batch update record statuses
  private async batchUpdateRecordStatuses(updates: Array<{ id: string; status: string; errorMessage?: string; processedAt?: Date }>) {
    for (const update of updates) {
      await this.recordRepository.update(update.id, {
        status: update.status as any,
        errorMessage: update.errorMessage,
        processedAt: update.processedAt
      });
    }
  }

  // Update job progress from records
  private async updateJobProgressFromRecords(jobId: string) {
    const completedCount = await this.recordRepository.count({
      where: { jobId, status: 'completed' }
    });
    
    const failedCount = await this.recordRepository.count({
      where: { jobId, status: 'failed' }
    });

    const job = await this.jobRepository.findOne({ where: { id: jobId } });
    if (!job) return;

    const pendingCount = job.totalRecords - completedCount - failedCount;

    await this.jobRepository.update(jobId, {
      processedRecords: completedCount + failedCount,
      voterLookupsCompleted: completedCount,
      voterLookupsFailed: failedCount,
      recordsPending: pendingCount
    });
  }

  // Update job status
  private async updateJobStatus(jobId: string, status: BulkUploadJob['status'], errorMessage?: string) {
    await this.jobRepository.update(jobId, {
      status,
      errorMessage,
      completedAt: status === 'completed' || status === 'failed' ? new Date() : null
    });
  }

  // Helper: Delay
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get job progress
  async getJobProgress(jobId: string): Promise<BulkUploadJob | null> {
    return this.jobRepository.findOne({ where: { id: jobId } });
  }

  // Get event jobs
  async getEventJobs(eventId: string): Promise<BulkUploadJob[]> {
    return this.jobRepository.find({
      where: { eventId },
      order: { createdAt: 'DESC' }
    });
  }

  // Retry failed job
  async retryFailedJob(jobId: string): Promise<BulkUploadJob> {
    const job = await this.jobRepository.findOne({ where: { id: jobId } });
    
    if (!job) {
      throw new Error('Job not found');
    }
    
    if (job.status !== 'failed') {
      throw new Error('Only failed jobs can be retried');
    }
    
    if (job.retryCount >= job.maxRetries) {
      throw new Error(`Maximum retry attempts exceeded (${job.maxRetries})`);
    }
    
    // Reset failed records back to pending
    await this.recordRepository.update(
      { jobId, status: 'failed' },
      { status: 'pending', errorMessage: null, processedAt: null }
    );
    
    await this.jobRepository.update(jobId, {
      status: 'pending',
      errorMessage: null,
      completedAt: null,
      retryCount: job.retryCount + 1,
      lastRetryAt: new Date(),
      processedRecords: 0,
      voterLookupsCompleted: 0,
      voterLookupsFailed: 0,
      recordsPending: job.totalRecords
    });
    
    return this.jobRepository.findOne({ where: { id: jobId } });
  }
}