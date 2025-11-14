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
      console.log('📄 PDF Generation started for event:', eventId);
      
      // Fetch event data
      const event = await this.eventService.findOne(eventId);
      console.log('✅ Event found:', event?.eventName);
      
      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }

      // Fetch participants for this event
      console.log('👥 Fetching participants...');
      const participants = await this.participantsService.findAll(eventId);
      console.log(`✅ Found ${participants?.length || 0} participants`);

      // Prepare event data for PDF
      const eventData = {
        eventName: event.eventName,
        eventDate: event.eventDate,
        location: event.location,
      };

      // Generate PDF
      console.log('📄 Generating PDF...');
      const pdfBuffer = await this.pdfService.generateEventReport(eventData, participants);
      console.log(`✅ PDF generated, size: ${pdfBuffer.length} bytes`);

      // Set response headers for PDF download
      const fileName = `Event_Report_${event.eventName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': pdfBuffer.length.toString(),
      });

      // Stream the PDF to the client
      res.send(pdfBuffer);
      console.log('✅ PDF sent to client');
      
    } catch (error) {
      console.error('❌ Error generating PDF report:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({ 
        message: 'Error generating PDF report',
        error: error.message 
      });
    }
  }

  @Get('event/:eventId/demographic')
  async generateDemographicReport(
    @Param('eventId') eventId: string,
    @Res() res: Response,
  ) {
    try {
      console.log('📊 Demographic PDF Generation started for event:', eventId);
      
      // Fetch event data
      const event = await this.eventService.findOne(eventId);
      console.log('✅ Event found:', event?.eventName);
      
      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }

      // Fetch participants for this event
      console.log('👥 Fetching participants...');
      const participants = await this.participantsService.findAll(eventId);
      console.log(`✅ Found ${participants?.length || 0} participants`);

      // Prepare event data for PDF
      const eventData = {
        eventName: event.eventName,
        eventDate: event.eventDate,
        location: event.location,
      };

      // Generate PDF
      console.log('📄 Generating Demographic PDF...');
      const pdfBuffer = await this.pdfService.generateDemographicReport(eventData, participants);
      console.log(`✅ PDF generated, size: ${pdfBuffer.length} bytes`);

      // Set response headers for PDF download
      const fileName = `Demographic_Report_${event.eventName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': pdfBuffer.length.toString(),
      });

      // Stream the PDF to the client
      res.send(pdfBuffer);
      console.log('✅ PDF sent to client');
      
    } catch (error) {
      console.error('❌ Error generating demographic PDF report:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({ 
        message: 'Error generating demographic PDF report',
        error: error.message 
      });
    }
  }
}
