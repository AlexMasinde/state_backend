import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BulkUploadJob } from './bulk-upload-job.entity';
import { BulkUploadRecord } from './entities/bulk-upload-record.entity';
import { EventService } from '../event/event.service';
import { ParticipantsService } from '../participants/participants.service';
import { SpacesService } from '../spaces/spaces.service';
import { VoterService } from '../voter/voter.service';
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

  private errorColumnsReady = false;
  private errorMessageMaxLen = 240; // safe for legacy varchar(255) until TEXT migrate

  private getErrorMessage(error: any): string {
    if (!error) return 'Unknown error';

    if (typeof error.getResponse === 'function') {
      const response = error.getResponse();
      if (typeof response === 'string' && response.trim()) return response.trim();
      if (response?.message) {
        return Array.isArray(response.message)
          ? response.message.join('; ')
          : String(response.message);
      }
    }

    if (error.message) return String(error.message);
    return String(error);
  }

  /** Keep messages usable in UI while avoiding DB overflow before TEXT migration. */
  private truncateErrorMessage(message: string): string {
    const maxLen = this.errorMessageMaxLen;
    const text = String(message || '').trim();
    if (text.length <= maxLen) return text;
    return `${text.slice(0, Math.max(maxLen - 15, 0))}… (truncated)`;
  }

  private async ensureErrorMessageColumns(): Promise<void> {
    if (this.errorColumnsReady) return;
    try {
      await this.jobRepository.query(
        `ALTER TABLE bulk_upload_jobs MODIFY COLUMN errorMessage TEXT NULL`,
      );
      await this.recordRepository.query(
        `ALTER TABLE bulk_upload_records MODIFY COLUMN errorMessage TEXT NULL`,
      );
      this.errorMessageMaxLen = 4000;
      this.errorColumnsReady = true;
      this.logger.log('Ensured bulk upload errorMessage columns are TEXT');
    } catch (error) {
      // Column may already be TEXT, or DB user may lack ALTER — keep short truncate.
      this.logger.warn(
        `Could not widen errorMessage columns: ${this.getErrorMessage(error)}`,
      );
      this.errorColumnsReady = true;
    }
  }

  private isBlank(value: unknown): boolean {
    return value === undefined || value === null || String(value).trim() === '';
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

      if (!records?.length) {
        throw new Error('No data rows found in the uploaded file');
      }

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
      await this.ensureErrorMessageColumns();
      await this.updateJobStatus(job.id, 'processing');
      await this.processJobWithVoterLookups(job);
      await this.finalizeJobOutcome(job.id);
      this.logger.log(`Job ${job.id} finished with status evaluation`);
    } catch (error) {
      const message = this.truncateErrorMessage(this.getErrorMessage(error));
      this.logger.error(`Job ${job.id} failed: ${message}`, error?.stack);
      await this.updateJobProgressFromRecords(job.id);
      await this.updateJobStatus(job.id, 'failed', message);
    } finally {
      this.activeJobs.delete(job.id);
    }
  }

  private buildDtoFromRecord(
    record: BulkUploadRecord,
    columnMapping: any,
    eventId: string,
  ): CreateParticipantDto {
    const data = record.recordData || {};
    const idNumber = columnMapping
      ? data[columnMapping.idNumberColumn]
      : data.idNumber;
    const name = columnMapping ? data[columnMapping.nameColumn] : data.name;
    const phoneNumber = columnMapping
      ? data[columnMapping.phoneNumberColumn]
      : data.phoneNumber;
    const group = columnMapping ? data[columnMapping.groupColumn] : data.group;
    const origin = columnMapping
      ? data[columnMapping.originColumn]
      : data.origin;

    const dto: CreateParticipantDto = {
      name: name === undefined || name === null ? '' : String(name).trim(),
      idNumber:
        idNumber === undefined || idNumber === null
          ? ''
          : String(idNumber).trim(),
      phoneNumber:
        phoneNumber === undefined || phoneNumber === null
          ? ''
          : String(phoneNumber).trim(),
      group: group === undefined || group === null ? '' : String(group).trim(),
      origin:
        origin === undefined || origin === null ? '' : String(origin).trim(),
      eventId,
    };

    if (columnMapping?.tokenNumberColumn) {
      const rawToken = data[columnMapping.tokenNumberColumn];
      dto.tokenNumber =
        rawToken === undefined || rawToken === null
          ? ''
          : String(rawToken).trim();
    }

    return dto;
  }

  private validateBatchDtos(
    batch: BulkUploadRecord[],
    dtos: CreateParticipantDto[],
  ): string | null {
    const missing: string[] = [];

    dtos.forEach((dto, index) => {
      const excelRow = (batch[index]?.rowIndex ?? index) + 2; // header + 1-based
      const blanks: string[] = [];
      if (this.isBlank(dto.idNumber)) blanks.push('ID Number');
      if (this.isBlank(dto.name)) blanks.push('Name');
      if (this.isBlank(dto.phoneNumber)) blanks.push('Phone Number');
      if (this.isBlank(dto.group)) blanks.push('Group');
      if (this.isBlank(dto.origin)) blanks.push('Origin');
      if (blanks.length) {
        missing.push(`row ${excelRow}: missing ${blanks.join(', ')}`);
      }
    });

    if (!missing.length) return null;

    const preview = missing.slice(0, 8).join('; ');
    const more = missing.length > 8 ? ` (+${missing.length - 8} more)` : '';
    return `Required fields missing in ${missing.length} row(s): ${preview}${more}`;
  }

  // Process job with voter lookups (batched)
  private async processJobWithVoterLookups(job: BulkUploadJob) {
    const columnMapping = job.columnMapping ? JSON.parse(job.columnMapping) : null;
    
    // Get all pending records for this job
    const pendingRecords = await this.recordRepository.find({
      where: { jobId: job.id, status: 'pending' },
      order: { rowIndex: 'ASC' }
    });

    if (pendingRecords.length === 0) {
      throw new Error(
        'No pending records found to process. The upload job has no row data.',
      );
    }

    this.logger.log(`🚀 Processing ${pendingRecords.length} records for job ${job.id} in batches of 1000`);

    const batchSize = 1000;
    for (let i = 0; i < pendingRecords.length; i += batchSize) {
      const batch = pendingRecords.slice(i, i + batchSize);
      
      try {
        const batchDtos: CreateParticipantDto[] = [];
        const batchIds: string[] = [];
        
        for (const record of batch) {
          const dto = this.buildDtoFromRecord(record, columnMapping, job.eventId);
          batchDtos.push(dto);
          batchIds.push(dto.idNumber);
          await this.recordRepository.update(record.id, { status: 'processing' });
        }

        const validationError = this.validateBatchDtos(batch, batchDtos);
        if (validationError) {
          throw new Error(validationError);
        }
        
        // Fetch Enrichment Data in Bulk (Parallel Voter/Adult lookup)
        const enrichmentData = await this.voterService.checkBulkRegistration(batchIds);
        
        // Create/Update Participants in Bulk
        await this.participantsService.bulkCreateOrUpdate(batchDtos, enrichmentData);
        
        // Update Records as Completed
        for (const record of batch) {
          const dto = this.buildDtoFromRecord(record, columnMapping, job.eventId);
          const enrichment = enrichmentData.get(dto.idNumber);
          
          await this.recordRepository.update(record.id, { 
            status: 'completed',
            voterData: enrichment ? JSON.stringify(enrichment) : null,
            processedAt: new Date()
          });
        }
        
        await this.updateJobProgressFromRecords(job.id);
        this.logger.log(`✅ Batch ${Math.floor(i/batchSize) + 1} complete (${Math.min(i + batchSize, pendingRecords.length)}/${pendingRecords.length})`);

      } catch (error) {
        const message = this.truncateErrorMessage(this.getErrorMessage(error));
        this.logger.error(`❌ Batch starting at index ${i} failed: ${message}`);
        for (const record of batch) {
          await this.recordRepository.update(record.id, { 
            status: 'failed',
            errorMessage: message,
            processedAt: new Date()
          });
        }
        await this.updateJobProgressFromRecords(job.id);
        throw new Error(message);
      }
    }
  }

  private async finalizeJobOutcome(jobId: string) {
    await this.updateJobProgressFromRecords(jobId);
    const job = await this.jobRepository.findOne({ where: { id: jobId } });
    if (!job) return;

    const completedCount = job.voterLookupsCompleted ?? 0;
    const failedCount = job.voterLookupsFailed ?? 0;
    const sampleFailures = await this.getSampleFailures(jobId, 5);

    if (failedCount > 0 || completedCount === 0) {
      const sampleText = sampleFailures.length
        ? sampleFailures.map((f) => f.errorMessage).filter(Boolean)[0]
        : null;
      const message = this.truncateErrorMessage(
        sampleText ||
          (completedCount === 0
            ? `Upload finished with 0 of ${job.totalRecords} records processed`
            : `${failedCount} of ${job.totalRecords} record(s) failed during upload`),
      );
      await this.updateJobStatus(jobId, 'failed', message);
      throw new Error(message);
    }

    await this.updateJobStatus(jobId, 'completed');
  }

  async getSampleFailures(
    jobId: string,
    limit = 5,
  ): Promise<Array<{ rowIndex: number; errorMessage: string | null }>> {
    const failures = await this.recordRepository.find({
      where: { jobId, status: 'failed' },
      order: { rowIndex: 'ASC' },
      take: limit,
      select: ['rowIndex', 'errorMessage'],
    });
    return failures.map((f) => ({
      rowIndex: f.rowIndex,
      errorMessage: f.errorMessage,
    }));
  }

  async toJobProgressPayload(job: BulkUploadJob) {
    const sampleErrors = job.status === 'failed'
      ? await this.getSampleFailures(job.id, 5)
      : [];

    return {
      id: job.id,
      jobId: job.id,
      fileName: job.fileName,
      totalRecords: job.totalRecords,
      processedRecords: job.processedRecords,
      voterLookupsCompleted: job.voterLookupsCompleted,
      voterLookupsFailed: job.voterLookupsFailed,
      recordsPending: job.recordsPending,
      status: job.status,
      progress:
        job.totalRecords > 0
          ? (job.processedRecords / job.totalRecords) * 100
          : 0,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
      error: job.errorMessage,
      sampleErrors: sampleErrors.map((item) => ({
        row: item.rowIndex + 2,
        message: item.errorMessage,
      })),
    };
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

    const pendingCount = Math.max(job.totalRecords - completedCount - failedCount, 0);

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
      errorMessage: errorMessage
        ? this.truncateErrorMessage(errorMessage)
        : null,
      completedAt: status === 'completed' || status === 'failed' ? new Date() : null
    });
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
