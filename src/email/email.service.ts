import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { env } from '../config/env.config';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(EmailService.name);

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: env.EMAIL_HOST,
      port: env.EMAIL_PORT,
      secure: env.EMAIL_PORT === 465, // true for 465, false for other ports
      auth: {
        user: env.EMAIL_USER,
        pass: env.EMAIL_PASSWORD,
      },
    });
  }

  async sendUserCredentials(email: string, name: string, password: string) {
    try {
      const mailOptions = {
        from: `"${env.EMAIL_FROM_NAME}" <${env.EMAIL_FROM}>`,
        to: email,
        subject: 'Your Account Credentials - Statehouse Event Management',
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Account Credentials</title>
            </head>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #2B9A8B 0%, #1a7a6f 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0;">Welcome to Statehouse Event Management</h1>
              </div>
              
              <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                <p>Dear ${name},</p>
                
                <p>Your account has been created successfully. Please use the following credentials to access your account:</p>
                
                <div style="background: white; border-left: 4px solid #2B9A8B; padding: 15px; margin: 20px 0; border-radius: 5px;">
                  <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
                  <p style="margin: 5px 0;"><strong>Password:</strong> <code style="background: #f0f0f0; padding: 5px 10px; border-radius: 3px; font-size: 14px;">${password}</code></p>
                </div>
                
                <p><strong>Important:</strong> Please change your password after your first login for security purposes.</p>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" style="background: #2B9A8B; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Login to Dashboard</a>
                </div>
                
                <p style="font-size: 12px; color: #666; margin-top: 30px;">
                  This is an automated email. Please do not reply to this message.<br>
                  If you have any questions, please contact the system administrator.
                </p>
              </div>
            </body>
          </html>
        `,
      };

      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`✅ Email sent successfully to ${email}`);
      this.logger.log(`📧 Message ID: ${info.messageId}`);
      return info;
    } catch (error) {
      this.logger.error(`❌ Failed to send email to ${email}:`, error);
      throw error;
    }
  }
}

