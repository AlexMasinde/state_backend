import { env } from '../config/env.config';

export const getJWTConstants = () => ({
  accessSecret: env.JWT_AT_SECRET,
  accessExpires: env.JWT_AT_EXPIRES || '15m',
  refreshSecret: env.JWT_RT_SECRET,
  refreshExpires: env.JWT_RT_EXPIRES || '7d',
  cookieDomain: env.COOKIE_DOMAIN,
  cookieSecure: env.COOKIE_SECURE === 'true',
  nodeEnv: env.NODE_ENV || 'development',
  port: parseInt(env.PORT) || 5100,
});

// Legacy constants for backward compatibility (deprecated)
export const JWTConstants = {
  accessSecret: 'replace_with_long_random_string_for_access',
  accessExpires: '1d',
  refreshSecret: 'replace_with_long_random_string_for_refresh',
  refreshExpires: '7d',
  cookieDomain: 'localhost',
  cookieSecure: false,
  nodeEnv: 'development',
  port: 5100,
};
