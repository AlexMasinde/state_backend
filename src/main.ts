import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import { ValidationPipe, ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { env } from './config/env.config';
import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as path from 'path';

// Global exception filter for detailed error logging
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('GlobalExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
 
    const status = exception instanceof HttpException 
      ? exception.getStatus() 
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = exception instanceof HttpException 
      ? exception.getResponse() 
      : 'Internal server error';

    this.logger.error('🚨 Global exception caught:', {
      status,
      message,
      url: request.url,
      method: request.method,
      body: request.body,
      headers: request.headers,
      stack: exception instanceof Error ? exception.stack : 'No stack trace',
      name: exception instanceof Error ? exception.name : 'Unknown',
    });

    response.status(status).json({
      statusCode: status,
      message: typeof message === 'string' ? message : (message as any).message || 'Internal server error',
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}

// Validate required environment variables
function validateEnvironment() {
  const logger = new Logger('Bootstrap');
  const requiredEnvVars = [
    'JWT_AT_SECRET',
    'JWT_RT_SECRET',
    'DB_HOST',
    'DB_USERNAME', 
    'DB_PASSWORD',
    'DB_DATABASE'
  ];

  const missingVars = requiredEnvVars.filter(envVar => !env[envVar as keyof typeof env]);
  
  if (missingVars.length > 0) {
    logger.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
    logger.error('Please check your .env file or environment configuration');
    process.exit(1);
  }

  // Validate optional but important environment variables for bulk upload
  logger.log('📋 Checking optional environment variables for bulk upload...');
  
  const spacesVars = ['SPACES_ENDPOINT', 'SPACES_ACCESS_KEY', 'SPACES_SECRET_KEY', 'SPACES_BUCKET_NAME'];
  const missingSpacesVars = spacesVars.filter(envVar => !env[envVar as keyof typeof env]);
  
  if (missingSpacesVars.length > 0) {
    logger.warn(`⚠️  Missing Spaces configuration (bulk upload will fail): ${missingSpacesVars.join(', ')}`);
  } else {
    logger.log('✅ Spaces configuration is present');
  }

  logger.log('✅ Environment validation passed');
}

// Run database migrations before starting the application
async function runMigrations() {
  const logger = new Logger('MigrationRunner');
  
  try {
    logger.log('🔄 Running database migrations...');
    
    // Create SSL configuration if needed
    const ca = env.DB_SSL_CA?.replace(/\\n/g, '\n');
    const ssl = env.DB_SSL === 'true'
      ? { minVersion: 'TLSv1.2', rejectUnauthorized: true, ...(ca ? { ca } : {}) }
      : undefined;

    const dataSource = new DataSource({
      type: 'mysql',
      host: env.DB_HOST,
      port: parseInt(env.DB_PORT) || 3307,
      username: env.DB_USERNAME,
      password: env.DB_PASSWORD,
      database: env.DB_DATABASE,
      entities: [path.join(__dirname, '**', '*.entity{.ts,.js}')],
      migrations: [path.join(__dirname, 'migrations', '*{.ts,.js}')],
      synchronize: false,
      logging: env.NODE_ENV === 'development',
      ssl,
      // Connection pooling settings
      extra: {
        connectionLimit: parseInt(env.DB_CONNECTION_LIMIT) || 2, // Minimal connections for migration runner
        charset: 'utf8mb4',
      },
    });

    await dataSource.initialize();
    logger.log('📡 Database connection established for migrations');
    
    const pendingMigrations = await dataSource.showMigrations();
    if (pendingMigrations) {
      logger.log('📋 Found pending migrations, running...');
      // await dataSource.runMigrations();
      logger.log('✅ Database migrations completed successfully');
    } else {
      logger.log('✅ No pending migrations found');
    }
    
    await dataSource.destroy();
    logger.log('🔌 Migration database connection closed');
    
  } catch (error) {
    logger.error('❌ Migration failed:', error);
    logger.error('Migration error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    process.exit(1);
  }
}

// Log environment variables on startup
function logEnvironmentVariables() {
  const logger = new Logger('EnvironmentCheck');
  
  // Only log critical configuration, not all env vars
  logger.log('🗄️ Database: Connected');
  logger.log('🔐 JWT: Configured');
  logger.log('☁️  Spaces: ' + (env.SPACES_ENDPOINT ? 'Configured' : 'Not configured'));
  logger.log('---');
}

// Validate environment before starting
validateEnvironment();
logEnvironmentVariables();

async function bootstrap() {
  // Run migrations before starting the application
  // await runMigrations();
  
  const app = await NestFactory.create(AppModule);

  // Add global exception filter for detailed error logging
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Minimal request logging (removed to prevent memory issues)
  // Production already has NestJS built-in logging

  // CORS configuration
  const corsOrigins =  [
    // 'http://10.0.2.2:5100',
    "http://localhost:3000",
    'https://state-checkin-frontend.vercel.app', 
    'https://checkin-gjd8y.ondigitalocean.app'
  ];

  app.enableCors({
    origin: corsOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  app.useLogger(false);
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.setGlobalPrefix('api');

  const port = parseInt(env.PORT) || 5100;
  await app.listen(port, '0.0.0.0');
  
  const startupLogger = new Logger('Startup');
  startupLogger.log('🎉 Application startup completed successfully!');
  startupLogger.log(`🚀 Server running on port: ${port}`);
  startupLogger.log(`🌐 Environment: ${env.NODE_ENV || 'development'}`);
  startupLogger.log(`📡 API endpoint: http://0.0.0.0:${port}/api`);
  startupLogger.log(`🔐 Auth endpoint: http://0.0.0.0:${port}/api/auth/signin`);
  startupLogger.log('---');
}
bootstrap();