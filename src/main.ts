import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';
import { env } from './config/env.config';
import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as path from 'path';

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

// Validate environment before starting
validateEnvironment();

async function bootstrap() {
  // Run migrations before starting the application
  await runMigrations();
  
  const app = await NestFactory.create(AppModule);

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
  console.log(`🚀 Application is running on: http://localhost:${port}`);
}
bootstrap();