import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BulkUploadJob } from './bulk-upload-job.entity';
import { BulkUploadRecord } from './entities/bulk-upload-record.entity';
import { BulkUploadService } from './bulk-upload.service';
import { BulkUploadController } from './bulk-upload.controller';
import { EventModule } from '../event/event.module';
import { ParticipantsModule } from '../participants/participants.module';
import { SpacesModule } from '../spaces/spaces.module';
import { VoterModule } from '../voter/voter.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BulkUploadJob, BulkUploadRecord]),
    EventModule,
    ParticipantsModule,
    SpacesModule,
    VoterModule,
    UsersModule,
  ],
  providers: [BulkUploadService],
  controllers: [BulkUploadController],
  exports: [BulkUploadService],
})
export class BulkUploadModule {}
