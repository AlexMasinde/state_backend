import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BulkUploadJob } from '../bulk-upload-job.entity';

@Entity('bulk_upload_records')
@Index(['jobId', 'status']) // Index for efficient querying
@Index(['jobId', 'rowIndex']) // Index for ordered processing
@Index(['status', 'rowIndex']) // Index for status-based queries
@Index(['jobId', 'status', 'processedAt']) // Index for progress tracking
export class BulkUploadRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  jobId: string;

  @Column()
  rowIndex: number;

  @Column('json')
  recordData: any;

  @Column({ 
    type: 'enum', 
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  })
  status: 'pending' | 'processing' | 'completed' | 'failed';

  @Column({ nullable: true })
  errorMessage: string;

  @Column({ nullable: true })
  processedAt: Date;

  @Column({ type: 'text', nullable: true })
  voterData: string; // JSON string of voter lookup results

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => BulkUploadJob, job => job.records, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'jobId' })
  job: BulkUploadJob;
}
