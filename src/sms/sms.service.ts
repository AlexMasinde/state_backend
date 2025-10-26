import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly source = process.env.SMS_LEOPARD_SOURCE || '';
  private readonly username = process.env.SMS_LEOPARD_USERNAME || '';
  private readonly password = process.env.SMS_LEOPARD_PASSWORD || '';

  private sanitizePhoneNumber(phoneNumber: string): string | { error: string } {
    let formattedMobileNumber = phoneNumber.replace(/^\+/, ''); // Remove leading '+'
    
    if (!formattedMobileNumber.startsWith('254')) {
      formattedMobileNumber = '254' + formattedMobileNumber.replace(/^0+/, '');
    }
    
    const valid = /^(\+254|254|0|)?[ ]?([7][0-9]|[1][0-1])[0-9][ ]?[0-9]{6}/.test(
      formattedMobileNumber
    );
    
    if (!valid) {
      return { error: 'Invalid phone number' };
    }

    return formattedMobileNumber;
  }

  async sendSMS(destination: string, message: string): Promise<boolean> {
    try {
      // Sanitize the phone number
      const sanitized = this.sanitizePhoneNumber(destination);
      
      if (typeof sanitized === 'object' && sanitized.error) {
        this.logger.error(`Invalid phone number: ${destination}`);
        process.stdout.write(`❌ Invalid phone number: ${destination} - ${sanitized.error}\n`);
        return false;
      }
      
      const sanitizedNumber = sanitized as string;
      
      const url = `https://api.smsleopard.com/v1/sms/send?message=${encodeURIComponent(message)}&source=${this.source}&username=${this.username}&password=${encodeURIComponent(this.password)}&destination=${sanitizedNumber}`;
      
      this.logger.log(`Sending SMS to ${sanitizedNumber} (original: ${destination})`);
      process.stdout.write(`📱 Attempting to send SMS to ${sanitizedNumber} (original: ${destination})\n`);
      
      await axios.get(url);
      
      this.logger.log(`SMS sent successfully to ${sanitizedNumber}`);
      process.stdout.write(`✅ SMS sent successfully to ${sanitizedNumber}\n`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send SMS to ${destination}:`, error);
      process.stdout.write(`❌ Failed to send SMS to ${destination}: ${error.message}\n`);
      return false;
    }
  }

  async sendCheckInConfirmation(
    phoneNumber: string, 
    participantName: string, 
    eventName: string
  ): Promise<boolean> {
    try {
      const message = `Dear ${participantName}, you have been successfully checked in to ${eventName}. Thank you for attending!`;
      return await this.sendSMS(phoneNumber, message);
    } catch (error) {
      this.logger.error(`Failed to send check-in confirmation:`, error);
      return false;
    }
  }
}
