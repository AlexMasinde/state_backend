import { Injectable } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class PdfService {
  private getLogoDataUrl(): string | null {
    try {
      // Path to the SVG logo in the frontend public folder
      const logoPath = path.join(process.cwd(), '../frontend/public/cof.svg');
      
      console.log('🔍 Looking for logo at:', logoPath);
      console.log('📁 Current working directory:', process.cwd());
      
      if (fs.existsSync(logoPath)) {
        const svgContent = fs.readFileSync(logoPath, 'utf8');
        // Convert SVG to base64 data URL
        const base64 = Buffer.from(svgContent).toString('base64');
        console.log('✅ Logo loaded successfully');
        return `data:image/svg+xml;base64,${base64}`;
      } else {
        console.warn('⚠️ Logo file not found at:', logoPath);
      }
    } catch (error) {
      console.warn('❌ Could not load logo file:', error.message);
    }
    
    // Fallback to text-based logo
    console.log('📝 Using text-based logo fallback');
    return null;
  }

  async generateEventReport(eventData: any, participants: any[]): Promise<Buffer> {
    console.log('🤖 Starting PDF generation with Puppeteer...');
    console.log(`📊 Event data:`, { eventName: eventData?.eventName, eventDate: eventData?.eventDate });
    console.log(`👥 Participants count: ${participants?.length || 0}`);
    
    let browser;
    try {
      console.log('🚀 Launching Puppeteer browser...');
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      console.log('✅ Browser launched successfully');

      console.log('📄 Creating new page...');
      const page = await browser.newPage();
      console.log('✅ Page created');
      
      // Generate HTML content
      console.log('🎨 Generating HTML content...');
      const htmlContent = this.generateHtmlContent(eventData, participants);
      console.log(`✅ HTML content generated (length: ${htmlContent.length} chars)`);
      
      console.log('📥 Setting page content...');
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
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
        }
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

  private generateHtmlContent(eventData: any, participants: any[]): string {
    console.log('🎨 Starting HTML content generation...');
    
    const checkedInParticipants = participants.filter(p => p.checkedIn);
    const totalParticipants = participants.length;
    const checkedInCount = checkedInParticipants.length;
    const notCheckedInCount = totalParticipants - checkedInCount;
    const checkInRate = totalParticipants > 0 ? Math.round((checkedInCount / totalParticipants) * 100) : 0;

    console.log(`📊 Stats: Total: ${totalParticipants}, Checked In: ${checkedInCount}, Rate: ${checkInRate}%`);

    // Get logo data URL
    const logoDataUrl = this.getLogoDataUrl();

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

    const groupStatsArray = Object.keys(groupStats).map(groupName => ({
      groupName,
      total: groupStats[groupName].total,
      checkedIn: groupStats[groupName].checkedIn,
      notCheckedIn: groupStats[groupName].total - groupStats[groupName].checkedIn,
      checkInRate: groupStats[groupName].total > 0 ? Math.round((groupStats[groupName].checkedIn / groupStats[groupName].total) * 100) : 0,
    })).sort((a, b) => b.total - a.total);

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

    <div class="title">EVENT ATTENDANCE REPORT</div>

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
            ${groupStatsArray.map(group => `
                <tr>
                    <td style="text-align: left;">${group.groupName}</td>
                    <td>${group.total}</td>
                    <td>${group.checkedIn}</td>
                    <td>${group.notCheckedIn}</td>
                    <td>${group.checkInRate}%</td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <div class="section-header">CHECKED-IN PARTICIPANTS</div>
    ${checkedInParticipants.length === 0 ? 
        '<p style="text-align: center; color: #666; font-style: italic; margin: 20px 0;">No participants have checked in yet.</p>' :
        `<table class="participants-table">
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
                ${checkedInParticipants.map((participant, index) => `
                    <tr>
                        <td style="text-align: center;">${index + 1}</td>
                        <td>${participant.name || 'N/A'}</td>
                        <td>${participant.idNumber || 'N/A'}</td>
                        <td>${participant.phoneNumber || 'N/A'}</td>
                        <td>${participant.group || 'N/A'}</td>
                        <td>${participant.origin || 'N/A'}</td>
                        <td style="text-align: center;">${participant.checkedInBy ? (participant.checkedInBy.name || 'Unknown') : 'N/A'}</td>
                    </tr>
                `).join('')}
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
          minute: '2-digit' 
        })}</p>
        <p>Statehouse Event Management System</p>
    </div>
</body>
</html>
    `;
  }
}
