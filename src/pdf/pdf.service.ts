import { Injectable } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import * as path from 'path';
import * as fs from 'fs';
import { env } from '../config/env.config';

@Injectable()
export class PdfService {
  private async getLogoDataUrl(): Promise<string | null> {
    try {
      // Fetch PNG logo from DigitalOcean Spaces
      const logoUrl =
        'https://mobilizers-bulk-uploads.nyc3.digitaloceanspaces.com/cof.png';

      console.log('🔍 Fetching logo from:', logoUrl);

      const response = await fetch(logoUrl);
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        console.log('✅ Logo loaded successfully');
        return `data:image/png;base64,${base64}`;
      } else {
        console.warn('⚠️ Could not fetch logo from URL:', response.statusText);
      }
    } catch (error) {
      console.warn('❌ Could not load logo:', error.message);
    }

    // Fallback to text-based logo
    console.log('📝 Using text-based logo fallback');
    return null;
  }

  async generateEventReport(
    eventData: any,
    participants: any[],
  ): Promise<Buffer> {
    console.log('🤖 Starting PDF generation with Puppeteer...');
    console.log(`📊 Event data:`, {
      eventName: eventData?.eventName,
      eventDate: eventData?.eventDate,
    });
    console.log(`👥 Participants count: ${participants?.length || 0}`);

    // Use PUPPETEER_EXECUTABLE_PATH if explicitly set, otherwise determine based on environment
    const isProd = env.NODE_ENV === 'production';
    const executablePath = env.PUPPETEER_EXECUTABLE_PATH
      ? env.PUPPETEER_EXECUTABLE_PATH
      : isProd
        ? '/usr/bin/chromium'
        : undefined;

    console.log(`🌍 Environment: ${isProd ? 'Production' : 'Development'}`);
    if (executablePath) {
      console.log(`📍 Using Chrome at: ${executablePath}`);
    } else {
      console.log(
        '📍 Using default Puppeteer Chromium (will use bundled or system Chrome)',
      );
    }

    let browser;
    try {
      console.log('🚀 Launching Puppeteer browser...');

      const launchOptions: any = {
        headless: true,
        args: isProd
          ? [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--disable-gpu',
              '--single-process',
            ]
          : [],
      };

      // Only set executablePath if it's defined (don't pass undefined)
      if (executablePath) {
        launchOptions.executablePath = executablePath;
      }

      browser = await puppeteer.launch(launchOptions);
      console.log('✅ Browser launched successfully');

      console.log('📄 Creating new page...');
      const page = await browser.newPage();
      page.setDefaultTimeout(240000); // allow Chromium enough time to render huge tables
      page.setDefaultNavigationTimeout(240000);
      console.log('✅ Page created');

      // Generate HTML content
      console.log('🎨 Generating HTML content...');
      const htmlContent = await this.generateHtmlContent(
        eventData,
        participants,
      );
      console.log(
        `✅ HTML content generated (length: ${htmlContent.length} chars)`,
      );

      console.log('📥 Setting page content...');
      await page.setContent(htmlContent, {
        waitUntil: 'domcontentloaded',
        timeout: 0, // DOMContentLoaded can easily take >30s with 1000s of rows
      });
      // Small delay to ensure layout is settled (using Promise instead of deprecated waitForTimeout)
      await new Promise((resolve) => setTimeout(resolve, 500));
      console.log('✅ Page content set');

      // Generate PDF
      console.log('📄 Generating PDF from page...');
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm',
        },
      });
      console.log(
        `✅ PDF generated successfully (size: ${pdfBuffer.length} bytes)`,
      );

      return Buffer.from(pdfBuffer);
    } catch (error) {
      console.error('❌ Error during PDF generation:', error.message);
      console.error('Error stack:', error.stack);
      throw error;
    } finally {
      if (browser) {
        console.log('🔒 Closing browser...');
        await browser.close();
        console.log('✅ Browser closed');
      }
    }
  }

  private async generateHtmlContent(
    eventData: any,
    participants: any[],
  ): Promise<string> {
    console.log('🎨 Starting HTML content generation...');

    const checkedInParticipants = participants.filter((p) => p.checkedIn);
    const totalParticipants = participants.length;
    const checkedInCount = checkedInParticipants.length;
    const notCheckedInCount = totalParticipants - checkedInCount;
    const checkInRate =
      totalParticipants > 0
        ? Math.round((checkedInCount / totalParticipants) * 100)
        : 0;

    console.log(
      `📊 Stats: Total: ${totalParticipants}, Checked In: ${checkedInCount}, Rate: ${checkInRate}%`,
    );

    // Get logo data URL
    const logoDataUrl = await this.getLogoDataUrl();

    // Group statistics
    const groupStats = participants.reduce((acc: any, participant: any) => {
      const groupName = participant.group || 'Unassigned';
      if (!acc[groupName]) {
        acc[groupName] = { total: 0, checkedIn: 0 };
      }
      acc[groupName].total++;
      if (participant.checkedIn) {
        acc[groupName].checkedIn++;
      }
      return acc;
    }, {});

    const groupStatsArray = Object.keys(groupStats)
      .map((groupName) => ({
        groupName,
        total: groupStats[groupName].total,
        checkedIn: groupStats[groupName].checkedIn,
        notCheckedIn:
          groupStats[groupName].total - groupStats[groupName].checkedIn,
        checkInRate:
          groupStats[groupName].total > 0
            ? Math.round(
                (groupStats[groupName].checkedIn /
                  groupStats[groupName].total) *
                  100,
              )
            : 0,
      }))
      .sort((a, b) => b.total - a.total);

    // Origin statistics
    const originStats = participants.reduce((acc: any, participant: any) => {
      const originName = participant.origin || 'Unassigned';
      if (!acc[originName]) {
        acc[originName] = { total: 0, checkedIn: 0 };
      }
      acc[originName].total++;
      if (participant.checkedIn) {
        acc[originName].checkedIn++;
      }
      return acc;
    }, {});

    const originStatsArray = Object.keys(originStats)
      .map((originName) => ({
        originName,
        total: originStats[originName].total,
        checkedIn: originStats[originName].checkedIn,
        notCheckedIn:
          originStats[originName].total - originStats[originName].checkedIn,
        checkInRate:
          originStats[originName].total > 0
            ? Math.round(
                (originStats[originName].checkedIn /
                  originStats[originName].total) *
                  100,
              )
            : 0,
      }))
      .sort((a, b) => b.total - a.total);

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Event Attendance Report</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Arial', sans-serif;
            font-size: 12px;
            line-height: 1.4;
            color: #333;
            background: white;
        }
        
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 30px;
            padding-bottom: 15px;
        }
        
        .logo-section {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .logo {
            width: 40px;
            height: 40px;
            background: #008469;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 18px;
        }
        
        .logo-img {
            width: 40px;
            height: 40px;
            object-fit: contain;
        }
        
        .company-info {
            text-align: right;
            font-size: 10px;
            color: #666;
        }
        
        .title {
            text-align: center;
            font-size: 20px;
            font-weight: bold;
            margin: 20px 0;
            color: #008469;
        }
        
        .event-info {
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            padding: 15px;
            margin-bottom: 20px;
            border-radius: 5px;
        }
        
        .event-info h3 {
            color: #008469;
            font-size: 14px;
            margin-bottom: 10px;
            border-bottom: 1px solid #008469;
            padding-bottom: 5px;
        }
        
        .event-details {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            font-size: 11px;
        }
        
        .section-header {
            font-size: 14px;
            font-weight: bold;
            color: #333;
            margin: 20px 0 10px 0;
            border-bottom: 2px solid #008469;
            padding-bottom: 5px;
        }
        
        .summary-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        
        .summary-table th,
        .summary-table td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
        }
        
        .summary-table th {
            background: #008469;
            color: white;
            font-weight: bold;
            text-align: center;
        }
        
        .summary-table tr:nth-child(even) {
            background: #f8f9fa;
        }
        
        .group-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        
        .group-table th,
        .group-table td {
            border: 1px solid #ddd;
            padding: 6px;
            text-align: center;
            font-size: 10px;
        }
        
        .group-table th {
            background: #008469;
            color: white;
            font-weight: bold;
        }
        
        .group-table tr:nth-child(even) {
            background: #f8f9fa;
        }
        
        .participants-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        
        .participants-table th,
        .participants-table td {
            border: 1px solid #ddd;
            padding: 4px;
            text-align: left;
            font-size: 9px;
        }
        
        .participants-table th {
            background: #008469;
            color: white;
            font-weight: bold;
            text-align: center;
        }
        
        .participants-table tr:nth-child(even) {
            background: #f8f9fa;
        }
        
        .footer {
            margin-top: 30px;
            padding-top: 15px;
            border-top: 2px solid #008469;
            text-align: center;
            font-size: 10px;
            color: #666;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 15px;
            margin-bottom: 20px;
        }
        
        .stat-card {
            border: 1px solid #ddd;
            padding: 15px;
            text-align: center;
            border-radius: 5px;
            background: white;
        }
        
        .stat-number {
            font-size: 24px;
            font-weight: bold;
            color: #008469;
        }
        
        .stat-label {
            font-size: 11px;
            color: #666;
            margin-top: 5px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo-section">
            ${
              logoDataUrl
                ? `<img src="${logoDataUrl}" alt="COF Logo" class="logo-img" />`
                : `<div class="logo">COF</div>`
            }
        </div>
        <div class="company-info">
            <strong>Statehouse Event Management System</strong><br>
            Nairobi, Kenya<br>
            Report Generated: ${new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })} at ${new Date().toLocaleTimeString()}
        </div>
    </div>

    <div class="title">EVENT ATTENDANCE REPORT</div>

    <div class="event-info">
        <h3>EVENT INFORMATION</h3>
        <div class="event-details">
            <div><strong>Event Name:</strong> ${eventData.eventName || 'Unknown Event'}</div>
            <div><strong>Event Date:</strong> ${new Date(
              eventData.eventDate || new Date(),
            ).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}</div>
            <div><strong>Location:</strong> ${eventData.location || 'Unknown Location'}</div>
            <div><strong>Total Participants:</strong> ${totalParticipants}</div>
        </div>
    </div>

    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-number">${totalParticipants}</div>
            <div class="stat-label">Total Participants</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${checkedInCount}</div>
            <div class="stat-label">Checked In</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${notCheckedInCount}</div>
            <div class="stat-label">Not Checked In</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${checkInRate}%</div>
            <div class="stat-label">Check-in Rate</div>
        </div>
    </div>

    <div class="section-header">ATTENDANCE BY GROUP</div>
    <table class="group-table">
        <thead>
            <tr>
                <th style="width: 30%;">Group</th>
                <th style="width: 15%;">Total</th>
                <th style="width: 15%;">Checked In</th>
                <th style="width: 15%;">Not Checked In</th>
                <th style="width: 15%;">Check-in Rate</th>
            </tr>
        </thead>
        <tbody>
            ${groupStatsArray
              .map(
                (group) => `
                <tr>
                    <td style="text-align: left;">${group.groupName}</td>
                    <td>${group.total}</td>
                    <td>${group.checkedIn}</td>
                    <td>${group.notCheckedIn}</td>
                    <td>${group.checkInRate}%</td>
                </tr>
            `,
              )
              .join('')}
        </tbody>
    </table>

    <div class="section-header">ATTENDANCE BY ORIGIN</div>
    <table class="group-table">
        <thead>
            <tr>
                <th style="width: 30%;">Origin</th>
                <th style="width: 15%;">Total</th>
                <th style="width: 15%;">Checked In</th>
                <th style="width: 15%;">Not Checked In</th>
                <th style="width: 15%;">Check-in Rate</th>
            </tr>
        </thead>
        <tbody>
            ${originStatsArray
              .map(
                (origin) => `
                <tr>
                    <td style="text-align: left;">${origin.originName}</td>
                    <td>${origin.total}</td>
                    <td>${origin.checkedIn}</td>
                    <td>${origin.notCheckedIn}</td>
                    <td>${origin.checkInRate}%</td>
                </tr>
            `,
              )
              .join('')}
        </tbody>
    </table>

    <div class="section-header">CHECKED-IN PARTICIPANTS</div>
    ${
      checkedInParticipants.length === 0
        ? '<p style="text-align: center; color: #666; font-style: italic; margin: 20px 0;">No participants have checked in yet.</p>'
        : `<table class="participants-table">
            <thead>
                <tr>
                    <th style="width: 4%;">#</th>
                    <th style="width: 20%;">Name</th>
                    <th style="width: 15%;">ID Number</th>
                    <th style="width: 15%;">Phone Number</th>
                    <th style="width: 15%;">Group</th>
                    <th style="width: 15%;">Origin</th>
                    <th style="width: 16%;">Checked In By</th>
                </tr>
            </thead>
            <tbody>
                ${checkedInParticipants
                  .map(
                    (participant, index) => `
                    <tr>
                        <td style="text-align: center;">${index + 1}</td>
                        <td>${participant.name || 'N/A'}</td>
                        <td>${participant.idNumber || 'N/A'}</td>
                        <td>${participant.phoneNumber || 'N/A'}</td>
                        <td>${participant.group || 'N/A'}</td>
                        <td>${participant.origin || 'N/A'}</td>
                        <td style="text-align: center;">${participant.checkedInBy ? participant.checkedInBy.name || 'Unknown' : 'N/A'}</td>
                    </tr>
                `,
                  )
                  .join('')}
            </tbody>
        </table>`
    }

    <div class="footer">
        <p>Report generated on ${new Date().toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}</p>
        <p>Statehouse Event Management System</p>
    </div>
</body>
</html>
    `;
  }

  // Helper function to calculate age from date of birth
  private calculateAge(dateOfBirth: Date | string | null): number | null {
    if (!dateOfBirth) return null;
    const birthDate = new Date(dateOfBirth);
    if (isNaN(birthDate.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  // Helper function to get age group
  private getAgeGroup(age: number | null): string {
    if (age === null) return 'NOT STATED';
    if (age >= 18 && age < 27) return '18-27';
    if (age >= 27 && age < 35) return '27-35';
    if (age >= 35 && age < 50) return '35-50';
    if (age >= 50 && age < 65) return '50-64';
    if (age >= 65) return '65+';
    return 'Under 18';
  }

  async generateDemographicReport(
    eventData: any,
    participants: any[],
  ): Promise<Buffer> {
    console.log('🤖 Starting Demographic PDF generation with Puppeteer...');
    console.log(`📊 Event data:`, { eventName: eventData?.eventName, eventDate: eventData?.eventDate });
    console.log(`👥 Participants count: ${participants?.length || 0}`);
    
    const isProd = env.NODE_ENV === 'production';
    const executablePath = isProd ? '/usr/bin/chromium' : undefined;
    
    console.log(`🌍 Environment: ${isProd ? 'Production' : 'Development'}`);
    if (executablePath) {
      console.log(`📍 Using Chrome at: ${executablePath}`);
    } else {
      console.log('📍 Using default Puppeteer Chromium (will use bundled or system Chrome)');
    }
    
    let browser;
    try {
      console.log('🚀 Launching Puppeteer browser...');
      
      const launchOptions: any = {
        headless: true,
        args: isProd
          ? [
              '--no-sandbox', 
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--disable-gpu',
              '--single-process'
            ]
          : [],
      };
      
      if (executablePath) {
        launchOptions.executablePath = executablePath;
      }
      
      browser = await puppeteer.launch(launchOptions);
      console.log('✅ Browser launched successfully');

      console.log('📄 Creating new page...');
      const page = await browser.newPage();
      page.setDefaultTimeout(120000);
      page.setDefaultNavigationTimeout(120000);
      console.log('✅ Page created');
      
      // Generate HTML content
      console.log('🎨 Generating HTML content...');
      const htmlContent = await this.generateDemographicHtmlContent(eventData, participants);
      console.log(`✅ HTML content generated (length: ${htmlContent.length} chars)`);
      
      console.log('📥 Setting page content...');
      await page.setContent(htmlContent, { 
        waitUntil: 'domcontentloaded',
        timeout: 0,
      });
      // Wait longer for Chart.js to render the pie charts
      await new Promise((resolve) => setTimeout(resolve, 2000));
      console.log('✅ Page content set');
      
      // Generate PDF
      console.log('📄 Generating PDF from page...');
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        },
      });
      console.log(`✅ PDF generated successfully (size: ${pdfBuffer.length} bytes)`);

      return Buffer.from(pdfBuffer);
    } catch (error) {
      console.error('❌ Error during PDF generation:', error.message);
      console.error('Error stack:', error.stack);
      throw error;
    } finally {
      if (browser) {
        console.log('🔒 Closing browser...');
        await browser.close();
        console.log('✅ Browser closed');
      }
    }
  }

  private async generateDemographicHtmlContent(
    eventData: any,
    participants: any[],
  ): Promise<string> {
    console.log('🎨 Starting Demographic HTML content generation...');
    
    const totalParticipants = participants.length;
    const logoDataUrl = await this.getLogoDataUrl();

    // 1. Distribution by County - use "NOT STATED" for null
    const countyStats = participants.reduce((acc: any, participant: any) => {
      const county = participant.county || 'NOT STATED';
      if (!acc[county]) {
        acc[county] = { registered: 0, nonRegistered: 0, total: 0 };
      }
      acc[county].total++;
      if (participant.registeredVoter) {
        acc[county].registered++;
      } else {
        acc[county].nonRegistered++;
      }
      return acc;
    }, {});

    const countyStatsArray = Object.keys(countyStats)
      .map(county => ({
        county,
        registered: countyStats[county].registered,
        nonRegistered: countyStats[county].nonRegistered,
        total: countyStats[county].total,
      }))
      .sort((a, b) => {
        // Put "NOT STATED" at the end
        if (a.county === 'NOT STATED') return 1;
        if (b.county === 'NOT STATED') return -1;
        return b.total - a.total;
      });

    // 2. Distribution by Group - use "NOT STATED" for null
    const groupStats = participants.reduce((acc: any, participant: any) => {
      const group = participant.group || 'NOT STATED';
      if (!acc[group]) {
        acc[group] = { registered: 0, nonRegistered: 0, total: 0 };
      }
      acc[group].total++;
      if (participant.registeredVoter) {
        acc[group].registered++;
      } else {
        acc[group].nonRegistered++;
      }
      return acc;
    }, {});

    const groupStatsArray = Object.keys(groupStats)
      .map(group => ({
        group,
        registered: groupStats[group].registered,
        nonRegistered: groupStats[group].nonRegistered,
        total: groupStats[group].total,
      }))
      .sort((a, b) => {
        if (a.group === 'NOT STATED') return 1;
        if (b.group === 'NOT STATED') return -1;
        return b.total - a.total;
      });

    // 3. Distribution by Tribe - use "NOT STATED" for null
    const tribeStats = participants.reduce((acc: any, participant: any) => {
      const tribe = participant.tribe || 'NOT STATED';
      if (!acc[tribe]) {
        acc[tribe] = { registered: 0, nonRegistered: 0, total: 0 };
      }
      acc[tribe].total++;
      if (participant.registeredVoter) {
        acc[tribe].registered++;
      } else {
        acc[tribe].nonRegistered++;
      }
      return acc;
    }, {});

    const tribeStatsArray = Object.keys(tribeStats)
      .map(tribe => ({
        tribe,
        registered: tribeStats[tribe].registered,
        nonRegistered: tribeStats[tribe].nonRegistered,
        total: tribeStats[tribe].total,
      }))
      .sort((a, b) => {
        if (a.tribe === 'NOT STATED') return 1;
        if (b.tribe === 'NOT STATED') return -1;
        return b.total - a.total;
      });

    // 4. Distribution by Gender - use "NOT STATED" for null
    const genderStats = participants.reduce((acc: any, participant: any) => {
      const gender = participant.gender || 'NOT STATED';
      if (!acc[gender]) {
        acc[gender] = { count: 0 };
      }
      acc[gender].count++;
      return acc;
    }, {});

    const genderStatsArray = Object.keys(genderStats)
      .map(gender => ({
        gender,
        count: genderStats[gender].count,
        percentage: totalParticipants > 0 ? Math.round((genderStats[gender].count / totalParticipants) * 100) : 0,
      }))
      .sort((a, b) => {
        if (a.gender === 'NOT STATED') return 1;
        if (b.gender === 'NOT STATED') return -1;
        return b.count - a.count;
      });

    // 5. Distribution by Registered Voter Status
    const registeredCount = participants.filter(p => p.registeredVoter).length;
    const nonRegisteredCount = totalParticipants - registeredCount;
    const voterStatusStats = {
      registered: registeredCount,
      nonRegistered: nonRegisteredCount,
      total: totalParticipants,
    };

    // 6. Distribution by Age Groups - use "NOT STATED" for null
    const ageGroupStats = participants.reduce((acc: any, participant: any) => {
      const age = this.calculateAge(participant.dateOfBirth);
      const ageGroup = this.getAgeGroup(age);
      if (!acc[ageGroup]) {
        acc[ageGroup] = { count: 0 };
      }
      acc[ageGroup].count++;
      return acc;
    }, {});

    const ageGroupStatsArray = [
      { group: '18-27', count: ageGroupStats['18-27']?.count || 0 },
      { group: '27-35', count: ageGroupStats['27-35']?.count || 0 },
      { group: '35-50', count: ageGroupStats['35-50']?.count || 0 },
      { group: '50-64', count: ageGroupStats['50-64']?.count || 0 },
      { group: '65+', count: ageGroupStats['65+']?.count || 0 },
      { group: 'NOT STATED', count: ageGroupStats['NOT STATED']?.count || 0 },
    ];

    // 7. Distribution by Constituency - use "NOT STATED" for null
    const constituencyStats = participants.reduce((acc: any, participant: any) => {
      const constituency = participant.constituency || 'NOT STATED';
      if (!acc[constituency]) {
        acc[constituency] = { registered: 0, nonRegistered: 0, total: 0 };
      }
      acc[constituency].total++;
      if (participant.registeredVoter) {
        acc[constituency].registered++;
      } else {
        acc[constituency].nonRegistered++;
      }
      return acc;
    }, {});

    const constituencyStatsArray = Object.keys(constituencyStats)
      .map(constituency => ({
        constituency,
        registered: constituencyStats[constituency].registered,
        nonRegistered: constituencyStats[constituency].nonRegistered,
        total: constituencyStats[constituency].total,
      }))
      .sort((a, b) => {
        // Put "NOT STATED" at the end
        if (a.constituency === 'NOT STATED') return 1;
        if (b.constituency === 'NOT STATED') return -1;
        return b.total - a.total;
      });

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Demographic Analysis Report</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Arial', sans-serif;
            font-size: 12px;
            line-height: 1.4;
            color: #333;
            background: white;
        }
        
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 30px;
            padding-bottom: 15px;
        }
        
        .logo-section {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .logo {
            width: 40px;
            height: 40px;
            background: #008469;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 18px;
        }
        
        .logo-img {
            width: 40px;
            height: 40px;
            object-fit: contain;
        }
        
        .company-info {
            text-align: right;
            font-size: 10px;
            color: #666;
        }
        
        .title {
            text-align: center;
            font-size: 20px;
            font-weight: bold;
            margin: 20px 0;
            color: #008469;
        }
        
        .event-info {
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            padding: 15px;
            margin-bottom: 20px;
            border-radius: 5px;
        }
        
        .event-info h3 {
            color: #008469;
            font-size: 14px;
            margin-bottom: 10px;
            border-bottom: 1px solid #008469;
            padding-bottom: 5px;
        }
        
        .event-details {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            font-size: 11px;
        }
        
        .section-header {
            font-size: 14px;
            font-weight: bold;
            color: #333;
            margin: 20px 0 10px 0;
            border-bottom: 2px solid #008469;
            padding-bottom: 5px;
        }
        
        .group-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        
        .group-table th,
        .group-table td {
            border: 1px solid #ddd;
            padding: 6px;
            text-align: center;
            font-size: 10px;
        }
        
        .group-table th {
            background: #008469;
            color: white;
            font-weight: bold;
        }
        
        .group-table tr:nth-child(even) {
            background: #f8f9fa;
        }
        
        .group-table td:first-child {
            text-align: left;
        }
        
        .charts-row {
            display: flex;
            justify-content: space-around;
            align-items: flex-start;
            margin: 20px 0;
            padding: 20px;
            gap: 30px;
        }
        
        .chart-container {
            display: flex;
            justify-content: center;
            align-items: center;
            flex: 1;
        }

        .chart-card {
            padding: 16px;
            border-radius: 12px;
            background: #ffffff;
            border: 1px solid #e5e7eb;
            box-shadow: none;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        
        .chart-wrapper {
            position: relative;
            width: 220px;
            height: 220px;
            border-radius: 10px;
            padding: 0;
            background: transparent;
            border: none;
            box-shadow: none;
            box-sizing: border-box;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        
        .footer {
            margin-top: 30px;
            padding-top: 15px;
            border-top: 2px solid #008469;
            text-align: center;
            font-size: 10px;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo-section">
            ${logoDataUrl ? 
                `<img src="${logoDataUrl}" alt="COF Logo" class="logo-img" />` : 
                `<div class="logo">COF</div>`
            }
        </div>
        <div class="company-info">
            <strong>Statehouse Event Management System</strong><br>
            Nairobi, Kenya<br>
            Report Generated: ${new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })} at ${new Date().toLocaleTimeString()}
        </div>
    </div>

    <div class="title">DEMOGRAPHIC ANALYSIS REPORT</div>

    <div class="event-info">
        <h3>EVENT INFORMATION</h3>
        <div class="event-details">
            <div><strong>Event Name:</strong> ${eventData.eventName || 'Unknown Event'}</div>
            <div><strong>Event Date:</strong> ${new Date(eventData.eventDate || new Date()).toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}</div>
            <div><strong>Location:</strong> ${eventData.location || 'Unknown Location'}</div>
            <div><strong>Total Participants:</strong> ${totalParticipants}</div>
        </div>
    </div>

    <!-- 1. Distribution by Gender & Voter Status -->
    <div class="section-header">1. PARTICIPANT DISTRIBUTION BY GENDER & VOTER REGISTRATION STATUS</div>
    <div class="charts-row">
        <div class="chart-container">
            <div class="chart-card">
                <div class="chart-wrapper">
                    <canvas id="genderChart" width="660" height="660" style="width: 220px; height: 220px;"></canvas>
                </div>
            </div>
        </div>
        <div class="chart-container">
            <div class="chart-card">
                <div class="chart-wrapper">
                    <canvas id="voterStatusChart" width="660" height="660" style="width: 220px; height: 220px;"></canvas>
                </div>
            </div>
        </div>
    </div>

    <!-- 2. Distribution by Group -->
    <div class="section-header">2. PARTICIPANT DISTRIBUTION BY GROUP</div>
    <table class="group-table">
        <thead>
            <tr>
                <th style="width: 40%;">Group</th>
                <th style="width: 20%;">Registered Voters</th>
                <th style="width: 20%;">Non-Registered Voters</th>
                <th style="width: 20%;">Total</th>
            </tr>
        </thead>
        <tbody>
            ${groupStatsArray.length === 0 ? 
                '<tr><td colspan="4" style="text-align: center; color: #666; font-style: italic;">No group data available</td></tr>' :
                groupStatsArray.map(group => `
                <tr>
                    <td>${group.group}</td>
                    <td>${group.registered}</td>
                    <td>${group.nonRegistered}</td>
                    <td><strong>${group.total}</strong></td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <!-- 3. Distribution by Tribe -->
    <div class="section-header">3. PARTICIPANT DISTRIBUTION BY TRIBE</div>
    <table class="group-table">
        <thead>
            <tr>
                <th style="width: 40%;">Tribe</th>
                <th style="width: 20%;">Registered Voters</th>
                <th style="width: 20%;">Non-Registered Voters</th>
                <th style="width: 20%;">Total</th>
            </tr>
        </thead>
        <tbody>
            ${tribeStatsArray.length === 0 ? 
                '<tr><td colspan="4" style="text-align: center; color: #666; font-style: italic;">No tribe data available</td></tr>' :
                tribeStatsArray.map(tribe => `
                <tr>
                    <td>${tribe.tribe}</td>
                    <td>${tribe.registered}</td>
                    <td>${tribe.nonRegistered}</td>
                    <td><strong>${tribe.total}</strong></td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <!-- 4. Distribution by Age Groups -->
    <div class="section-header">4. PARTICIPANT DISTRIBUTION BY AGE GROUP</div>
    <table class="group-table">
        <thead>
            <tr>
                <th style="width: 50%;">Age Group</th>
                <th style="width: 25%;">Count</th>
                <th style="width: 25%;">Percentage</th>
            </tr>
        </thead>
        <tbody>
            ${ageGroupStatsArray.map(ageGroup => `
                <tr>
                    <td>${ageGroup.group} years</td>
                    <td>${ageGroup.count}</td>
                    <td>${totalParticipants > 0 ? Math.round((ageGroup.count / totalParticipants) * 100) : 0}%</td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <!-- 5. Distribution by County -->
    <div class="section-header">5. PARTICIPANT DISTRIBUTION BY COUNTY</div>
    <table class="group-table">
        <thead>
            <tr>
                <th style="width: 40%;">County</th>
                <th style="width: 20%;">Registered Voters</th>
                <th style="width: 20%;">Non-Registered Voters</th>
                <th style="width: 20%;">Total</th>
            </tr>
        </thead>
        <tbody>
            ${countyStatsArray.length === 0 ? 
                '<tr><td colspan="4" style="text-align: center; color: #666; font-style: italic;">No county data available</td></tr>' :
                countyStatsArray.map(county => `
                <tr>
                    <td>${county.county}</td>
                    <td>${county.registered}</td>
                    <td>${county.nonRegistered}</td>
                    <td><strong>${county.total}</strong></td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <!-- 6. Distribution by Constituency -->
    <div class="section-header">6. PARTICIPANT DISTRIBUTION BY CONSTITUENCY</div>
    <table class="group-table">
        <thead>
            <tr>
                <th style="width: 40%;">Constituency</th>
                <th style="width: 20%;">Registered Voters</th>
                <th style="width: 20%;">Non-Registered Voters</th>
                <th style="width: 20%;">Total</th>
            </tr>
        </thead>
        <tbody>
            ${constituencyStatsArray.length === 0 ? 
                '<tr><td colspan="4" style="text-align: center; color: #666; font-style: italic;">No constituency data available</td></tr>' :
                constituencyStatsArray.map(constituency => `
                <tr>
                    <td>${constituency.constituency}</td>
                    <td>${constituency.registered}</td>
                    <td>${constituency.nonRegistered}</td>
                    <td><strong>${constituency.total}</strong></td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <div class="footer">
        <p>Report generated on ${new Date().toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit' 
        })}</p>
        <p>Statehouse Event Management System - Demographic Analysis</p>
    </div>
    
    <script>
        // Gender Distribution Pie Chart
        const genderCtx = document.getElementById('genderChart');
        if (genderCtx) {
            const genderData = ${JSON.stringify(genderStatsArray.map(g => ({ label: g.gender, value: g.count, percentage: g.percentage })))};
            new Chart(genderCtx, {
                type: 'pie',
                data: {
                    labels: genderData.map(item => item.label),
                    datasets: [{
                        data: genderData.map(item => item.value),
                        backgroundColor: [
                            '#2B9A8B',
                            '#F97316',
                            '#7C3AED',
                            '#3B82F6',
                            '#F59E0B'
                        ],
                        borderWidth: 3,
                        borderColor: '#ffffff',
                        hoverBorderWidth: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    devicePixelRatio: 3,
                    animation: false,
                    layout: {
                        padding: {
                            top: 0,
                            bottom: 0,
                            left: 0,
                            right: 0
                        }
                    },
                    plugins: {
                        legend: {
                            position: 'bottom',
                            align: 'center',
                            labels: {
                                padding: 12,
                                font: {
                                    size: 11,
                                    weight: '500',
                                    family: 'Arial'
                                },
                                usePointStyle: true,
                                pointStyle: 'circle',
                                boxWidth: 12,
                                boxHeight: 12
                            }
                        },
                        tooltip: {
                            enabled: false
                        }
                    },
                    elements: {
                        arc: {
                            borderWidth: 3,
                            borderColor: '#ffffff'
                        }
                    }
                },
                plugins: [{
                    id: 'datalabels',
                    afterDraw: function(chart) {
                        const ctx = chart.ctx;
                        chart.data.datasets.forEach((dataset, i) => {
                            const meta = chart.getDatasetMeta(i);
                            meta.data.forEach((element, index) => {
                                const value = dataset.data[index];
                                if (value === 0) return; // Skip empty segments
                                const total = dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                                
                                ctx.save();
                                
                                // Add text shadow for better readability
                                ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
                                ctx.shadowBlur = 2;
                                ctx.shadowOffsetX = 1;
                                ctx.shadowOffsetY = 1;
                                
                                // Get the center point of the pie segment
                                const position = element.getCenterPoint();
                                
                                // Draw count with larger, bolder font
                                ctx.fillStyle = '#ffffff';
                                ctx.font = 'bold 14px Arial';
                                ctx.textAlign = 'center';
                                ctx.textBaseline = 'middle';
                                ctx.fillText(value.toString(), position.x, position.y - 7);
                                
                                // Draw percentage with smaller font
                                ctx.font = '11px Arial';
                                ctx.fillText(percentage + '%', position.x, position.y + 7);
                                
                                ctx.restore();
                            });
                        });
                    }
                }]
            });
        }
        
        // Voter Status Distribution Pie Chart
        const voterCtx = document.getElementById('voterStatusChart');
        if (voterCtx) {
            const voterData = [
                { label: 'Registered Voters', value: ${voterStatusStats.registered}, percentage: ${totalParticipants > 0 ? Math.round((voterStatusStats.registered / totalParticipants) * 100) : 0} },
                { label: 'Non-Registered Voters', value: ${voterStatusStats.nonRegistered}, percentage: ${totalParticipants > 0 ? Math.round((voterStatusStats.nonRegistered / totalParticipants) * 100) : 0} }
            ];
            new Chart(voterCtx, {
                type: 'pie',
                data: {
                    labels: voterData.map(item => item.label),
                    datasets: [{
                        data: voterData.map(item => item.value),
                        backgroundColor: [
                            '#2B9A8B',
                            '#F97316'
                        ],
                        borderWidth: 3,
                        borderColor: '#ffffff',
                        hoverBorderWidth: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    devicePixelRatio: 3,
                    animation: false,
                    layout: {
                        padding: {
                            top: 0,
                            bottom: 0,
                            left: 0,
                            right: 0
                        }
                    },
                    plugins: {
                        legend: {
                            position: 'bottom',
                            align: 'center',
                            labels: {
                                padding: 12,
                                font: {
                                    size: 11,
                                    weight: '500',
                                    family: 'Arial'
                                },
                                usePointStyle: true,
                                pointStyle: 'circle',
                                boxWidth: 12,
                                boxHeight: 12
                            }
                        },
                        tooltip: {
                            enabled: false
                        }
                    },
                    elements: {
                        arc: {
                            borderWidth: 3,
                            borderColor: '#ffffff'
                        }
                    }
                },
                plugins: [{
                    id: 'datalabels',
                    afterDraw: function(chart) {
                        const ctx = chart.ctx;
                        chart.data.datasets.forEach((dataset, i) => {
                            const meta = chart.getDatasetMeta(i);
                            meta.data.forEach((element, index) => {
                                const value = dataset.data[index];
                                if (value === 0) return; // Skip empty segments
                                const total = dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                                
                                ctx.save();
                                
                                // Add text shadow for better readability
                                ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
                                ctx.shadowBlur = 2;
                                ctx.shadowOffsetX = 1;
                                ctx.shadowOffsetY = 1;
                                
                                // Get the center point of the pie segment
                                const position = element.getCenterPoint();
                                
                                // Draw count with larger, bolder font
                                ctx.fillStyle = '#ffffff';
                                ctx.font = 'bold 14px Arial';
                                ctx.textAlign = 'center';
                                ctx.textBaseline = 'middle';
                                ctx.fillText(value.toString(), position.x, position.y - 7);
                                
                                // Draw percentage with smaller font
                                ctx.font = '11px Arial';
                                ctx.fillText(percentage + '%', position.x, position.y + 7);
                                
                                ctx.restore();
                            });
                        });
                    }
                }]
            });
        }
    </script>
</body>
</html>
    `;
  }
}
