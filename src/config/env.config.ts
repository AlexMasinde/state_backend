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
  
  // SMS Leopard Configuration
  SMS_LEOPARD_SOURCE: process.env.SMS_LEOPARD_SOURCE || '',
  SMS_LEOPARD_USERNAME: process.env.SMS_LEOPARD_USERNAME || '',
  SMS_LEOPARD_PASSWORD: process.env.SMS_LEOPARD_PASSWORD || '',
  
  // Email Configuration
  EMAIL_HOST: process.env.EMAIL_HOST || 'smtp.gmail.com',
  EMAIL_PORT: parseInt(process.env.EMAIL_PORT || '465'),
  EMAIL_USER: process.env.EMAIL_USER || '',
  EMAIL_PASSWORD: process.env.EMAIL_PASSWORD || '',
  EMAIL_FROM: process.env.EMAIL_FROM || '',
  EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME || 'Statehouse Event Management',

  // Voter Service Configuration (Optional - Frappe API)
  FRAPPE_API_URL: process.env.FRAPPE_API_URL || '',
  FRAPPE_API_KEY: process.env.FRAPPE_API_KEY || '',
  FRAPPE_API_SECRET: process.env.FRAPPE_API_SECRET || '',

  // Spaces Configuration (DigitalOcean Spaces)
  SPACES_ENDPOINT: process.env.SPACES_ENDPOINT || '',
  SPACES_REGION: process.env.SPACES_REGION || '',
  SPACES_ACCESS_KEY: process.env.SPACES_ACCESS_KEY || '',
  SPACES_SECRET_KEY: process.env.SPACES_SECRET_KEY || '',
  SPACES_BUCKET_NAME: process.env.SPACES_BUCKET_NAME || '',
  
  // Puppeteer Configuration
  PUPPETEER_EXECUTABLE_PATH: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
};