import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { PdfService } from './pdf.service';
import { AtGuard } from '../auth/guards/at.guard';
import { EventService } from '../event/event.service';
import { ParticipantsService } from '../participants/participants.service';

@UseGuards(AtGuard)
@Controller('pdf')
export class PdfController {
  constructor(
    private readonly pdfService: PdfService,
    private readonly eventService: EventService,
    private readonly participantsService: ParticipantsService,
  ) {}

  @Get('event/:eventId/report')
  async generateEventReport(
    @Param('eventId') eventId: string,
    @Res() res: Response,
  ) {
    try {
      // Fetch event data
      const event = await this.eventService.findOne(eventId);
      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }

      // Fetch participants for this event
      const participants = await this.participantsService.findAll(eventId);

      // Prepare event data for PDF
      const eventData = {
        eventName: event.eventName,
        eventDate: event.eventDate,
        location: event.location,
      };

      // Generate PDF
      const pdfBuffer = await this.pdfService.generateEventReport(eventData, participants);

      // Set response headers for PDF download
      const fileName = `Event_Report_${event.eventName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': pdfBuffer.length.toString(),
      });

      // Stream the PDF to the client
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Error generating PDF report:', error);
      res.status(500).json({ 
        message: 'Error generating PDF report',
        error: error.message 
      });
    }
  }
}
