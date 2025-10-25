import { Module } from '@nestjs/common';
import { PdfController } from './pdf.controller';
import { PdfService } from './pdf.service';
import { EventModule } from '../event/event.module';
import { ParticipantsModule } from '../participants/participants.module';

@Module({
  imports: [EventModule, ParticipantsModule],
  controllers: [PdfController],
  providers: [PdfService],
  exports: [PdfService],
})
export class PdfModule {}
