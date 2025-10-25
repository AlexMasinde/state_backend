import * as dotenv from 'dotenv';

// Load .env file (dotenv will look in the current working directory)
dotenv.config();

// Export environment variables for use in other modules
export const env = {
  // Application Configuration
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  
  // Database Configuration
  DB_HOST: process.env.DB_HOST,
  DB_PORT: process.env.DB_PORT,
  DB_USERNAME: process.env.DB_USERNAME,
  DB_PASSWORD: process.env.DB_PASSWORD,
  DB_DATABASE: process.env.DB_DATABASE,
  DB_CONNECTION_LIMIT: process.env.DB_CONNECTION_LIMIT,
  DB_SSL: process.env.DB_SSL,
  DB_SSL_CA: process.env.DB_SSL_CA,
  DB_SSL_MIN_VERSION: process.env.DB_SSL_MIN_VERSION,
  
  // JWT Configuration
  JWT_AT_SECRET: process.env.JWT_AT_SECRET,
  JWT_AT_EXPIRES: process.env.JWT_AT_EXPIRES,
  JWT_RT_SECRET: process.env.JWT_RT_SECRET,
  JWT_RT_EXPIRES: process.env.JWT_RT_EXPIRES,
  
  // Cookie Configuration
  COOKIE_DOMAIN: process.env.COOKIE_DOMAIN,
  COOKIE_SECURE: process.env.COOKIE_SECURE,
  
  // CORS Configuration
  CORS_ORIGINS: process.env.CORS_ORIGINS,
};



