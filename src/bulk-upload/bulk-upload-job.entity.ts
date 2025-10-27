import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, Index } from 'typeorm';
import { BulkUploadRecord } from './entities/bulk-upload-record.entity';

@Entity('bulk_upload_jobs')
@Index(['status']) // For job status queries
@Index(['eventId', 'status']) // For event-specific job queries
@Index(['createdAt']) // For job ordering
export class BulkUploadJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  eventId: string;

  @Column()
  fileName: string;

  @Column('text', { nullable: true })
  columnMapping: string; // JSON string of column mapping

  @Column('text', { nullable: true })
  originalFileUrl: string; // URL to file in Spaces

  @Column()
  totalRecords: number;

  @Column({ default: 0 })
  processedRecords: number;

  @Column({ default: 0 })
  voterLookupsCompleted: number;

  @Column({ default: 0 })
  voterLookupsFailed: number;

  @Column({ default: 0 })
  recordsPending: number;

  @Column({
    type: 'enum',
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  })
  status: 'pending' | 'processing' | 'completed' | 'failed';

  @Column({ nullable: true })
  errorMessage: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  completedAt: Date;

  // Retry tracking fields
  @Column({ default: 0 })
  retryCount: number;

  @Column({ nullable: true })
  lastRetryAt: Date;

  @Column({ default: 3 })
  maxRetries: number;

  // Relations
  @OneToMany(() => BulkUploadRecord, record => record.job, { cascade: true })
  records: BulkUploadRecord[];
}
