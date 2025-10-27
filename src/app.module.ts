import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EventModule } from './event/event.module';
import { AuthModule } from './auth/auth.module';
import { ParticipantsModule } from './participants/participants.module';
import { PdfModule } from './pdf/pdf.module';
import { SmsModule } from './sms/sms.module';
import { UsersModule } from './users/users.module';
import { VoterModule } from './voter/voter.module';
import { SpacesModule } from './spaces/spaces.module';
import { BulkUploadModule } from './bulk-upload/bulk-upload.module';
import { databaseConfig } from './config/database.config';

@Module({
  imports: [
    TypeOrmModule.forRoot(databaseConfig),
    EventModule,
    ParticipantsModule,
    AuthModule,
    PdfModule,
    SmsModule,
    UsersModule,
    VoterModule,
    SpacesModule,
    BulkUploadModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
