import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventModule } from './event/event.module';
import { AuthModule } from './auth/auth.module';
import { ParticipantsModule } from './participants/participants.module';
import { PdfModule } from './pdf/pdf.module';
import { databaseConfig } from './config/database.config';

@Module({
  imports: [
    TypeOrmModule.forRoot(databaseConfig),
    EventModule,
    ParticipantsModule,
    AuthModule,
    PdfModule,
  ],
})
export class AppModule {}
