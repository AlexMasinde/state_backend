import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { Logger } from '@nestjs/common';
import { env } from './env.config';

// Debug: Log connection parameters
const logger = new Logger('DatabaseConfig');
logger.debug('🔍 Database connection parameters:', {
  host: env.DB_HOST,
  port: env.DB_PORT,
  username: env.DB_USERNAME,
  database: env.DB_DATABASE,
  hasPassword: !!env.DB_PASSWORD,
  hasCert: !!env.DB_SSL_CA,
  hasSsl: !!env.DB_SSL,
});

const ca = env.DB_SSL_CA?.replace(/\\n/g, '\n');
const ssl =
  env.DB_SSL === 'true'
    ? { minVersion: 'TLSv1.2', rejectUnauthorized: true, ...(ca ? { ca } : {}) }
    : undefined;

export const databaseConfig: TypeOrmModuleOptions = {
  type: 'mysql',
  host: env.DB_HOST,
  port: parseInt(env.DB_PORT) || 3307,
  username: env.DB_USERNAME,
  password: env.DB_PASSWORD,
  database: env.DB_DATABASE,
  autoLoadEntities: true,
  ssl,
  synchronize: env.NODE_ENV !== 'production',
  logging: env.NODE_ENV === 'development',

  // Add connection retry and timeout settings
  retryAttempts: 3,
  retryDelay: 3000,

  // Database connection pooling settings
  extra: {
    connectionLimit: parseInt(env.DB_CONNECTION_LIMIT) || 20, // Maximum number of connections in the pool
    charset: 'utf8mb4', // Use utf8mb4 for full Unicode support
    // Note: acquireTimeout, timeout, and reconnect are deprecated in MySQL2
    // These are handled automatically by the connection pool
  },
};
