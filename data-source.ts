import { DataSource } from 'typeorm';
import * as path from 'path';
import { env } from './src/config/env.config';

// Create SSL configuration if needed
const ca = env.DB_SSL_CA?.replace(/\\n/g, '\n');
const ssl = env.DB_SSL === 'true'
  ? { minVersion: 'TLSv1.2', rejectUnauthorized: true, ...(ca ? { ca } : {}) }
  : undefined;

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: env.DB_HOST,
  port: parseInt(env.DB_PORT) || 3307,
  username: env.DB_USERNAME,
  password: env.DB_PASSWORD,
  database: env.DB_DATABASE,
  entities: [path.join(__dirname, 'src', '**', '*.entity{.ts,.js}')],
  migrations: [path.join(__dirname, 'src', 'migrations', '*{.ts,.js}')],
  synchronize: false,
  logging: env.NODE_ENV === 'development',
  ssl,
  // Connection pooling settings
  extra: {
    connectionLimit: parseInt(env.DB_CONNECTION_LIMIT) || 20,
    charset: 'utf8mb4',
  },
});
