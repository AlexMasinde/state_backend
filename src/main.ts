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
        connectionLimit: parseInt(env.DB_CONNECTION_LIMIT) || 20,
        charset: 'utf8mb4',
      },
    });

    await dataSource.initialize();
    logger.log('📡 Database connection established for migrations');
    
    const pendingMigrations = await dataSource.showMigrations();
    if (pendingMigrations) {
      logger.log('📋 Found pending migrations, running...');
      await dataSource.runMigrations();
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
  
  logger.log('🔐 JWT Environment Variables:');
  logger.log(`📏 JWT_AT_SECRET: ${env.JWT_AT_SECRET ? `Present (${env.JWT_AT_SECRET.length} chars)` : 'MISSING'}`);
  logger.log(`📏 JWT_RT_SECRET: ${env.JWT_RT_SECRET ? `Present (${env.JWT_RT_SECRET.length} chars)` : 'MISSING'}`);
  logger.log(`⏰ JWT_AT_EXPIRES: ${env.JWT_AT_EXPIRES || 'Not set (using default: 15m)'}`);
  logger.log(`⏰ JWT_RT_EXPIRES: ${env.JWT_RT_EXPIRES || 'Not set (using default: 7d)'}`);
  
  // Log first few characters of secrets for verification (not full secrets for security)
  if (env.JWT_AT_SECRET) {
    logger.log(`🔑 JWT_AT_SECRET preview: ${env.JWT_AT_SECRET.substring(0, 8)}...`);
  }
  if (env.JWT_RT_SECRET) {
    logger.log(`🔑 JWT_RT_SECRET preview: ${env.JWT_RT_SECRET.substring(0, 8)}...`);
  }
  
  logger.log('🗄️ Database Environment Variables:');
  logger.log(`🏠 DB_HOST: ${env.DB_HOST || 'MISSING'}`);
  logger.log(`🔌 DB_PORT: ${env.DB_PORT || 'MISSING'}`);
  logger.log(`👤 DB_USERNAME: ${env.DB_USERNAME || 'MISSING'}`);
  logger.log(`🔐 DB_PASSWORD: ${env.DB_PASSWORD ? 'Present' : 'MISSING'}`);
  logger.log(`📊 DB_DATABASE: ${env.DB_DATABASE || 'MISSING'}`);
  logger.log(`🔒 DB_SSL: ${env.DB_SSL || 'Not set (default: false)'}`);
  
  logger.log('🌐 Application Environment:');
  logger.log(`🚀 NODE_ENV: ${env.NODE_ENV || 'Not set'}`);
  logger.log(`🔌 PORT: ${env.PORT || 'Not set (using default: 5100)'}`);
  logger.log(`🍪 COOKIE_DOMAIN: ${env.COOKIE_DOMAIN || 'Not set'}`);
  logger.log(`🔒 COOKIE_SECURE: ${env.COOKIE_SECURE || 'Not set (default: false)'}`);
  logger.log(`🌍 CORS_ORIGINS: ${env.CORS_ORIGINS || 'Not set (using defaults)'}`);
  
  logger.log('---');
}

// Validate environment before starting
validateEnvironment();
logEnvironmentVariables();

async function bootstrap() {
  // Run migrations before starting the application
  await runMigrations();
  
  const app = await NestFactory.create(AppModule);

  // Add global exception filter for detailed error logging
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Add comprehensive request logging middleware using process.stdout
  app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    
    process.stdout.write(`📡 [${timestamp}] ${req.method} ${req.url}\n`);
    process.stdout.write(`🌐 IP: ${req.ip || req.connection.remoteAddress}\n`);
    process.stdout.write(`🔗 User-Agent: ${req.get('User-Agent') || 'Unknown'}\n`);
    process.stdout.write(`📋 Headers: ${JSON.stringify(req.headers)}\n`);
    
    if (req.body && Object.keys(req.body).length > 0) {
      process.stdout.write(`📦 Body: ${JSON.stringify(req.body)}\n`);
    }
    
    process.stdout.write(`📊 Query: ${JSON.stringify(req.query)}\n`);
    process.stdout.write(`🔍 Params: ${JSON.stringify(req.params)}\n`);
    process.stdout.write('---\n');
    
    next();
  });

  // CORS configuration
  const corsOrigins = env.CORS_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'http://localhost:3002',
    'http://10.0.2.2:5100',
    'http://192.168.100.3:5100'
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