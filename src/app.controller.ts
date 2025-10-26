import { Controller, Get, Logger } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    this.logger.log('🏠 Root endpoint accessed');
    return this.appService.getHello();
  }

  @Get('health')
  getHealth() {
    const response = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0'
    };
    
    // Log using both logger and process.stdout
    this.logger.log('💚 Health check endpoint accessed');
    process.stdout.write(`💚 Health check - Status: ${response.status}, Uptime: ${response.uptime}s\n`);
    
    return response;
  }

  @Get('health/detailed')
  getDetailedHealth() {
    const response = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      memory: process.memoryUsage(),
      platform: process.platform,
      nodeVersion: process.version,
      pid: process.pid
    };
    
    // Log using both logger and process.stdout
    this.logger.log('🔍 Detailed health check endpoint accessed');
    process.stdout.write(`🔍 Detailed health check - Status: ${response.status}\n`);
    process.stdout.write(`📊 Memory: ${JSON.stringify(response.memory)}\n`);
    
    return response;
  }
}
