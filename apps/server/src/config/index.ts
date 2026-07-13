import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  
  databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/zpos',
  
  jwtSecret: process.env.JWT_SECRET || 'your-jwt-secret-change-in-production',
  jwtAccessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
  jwtRefreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  
  fbr: {
    environment: process.env.FBR_ENVIRONMENT || 'sandbox',
    sandbox: {
      endpoint: process.env.FBR_SANDBOX_ENDPOINT || 'https://esp.fbr.gov.pk:8244/FBR/v1',
      bearerToken: process.env.FBR_SANDBOX_TOKEN || '',
      posId: process.env.FBR_SANDBOX_POSID || '',
    },
    production: {
      endpoint: process.env.FBR_PROD_ENDPOINT || 'https://esp.fbr.gov.pk:8244/FBR/Production/v1',
      bearerToken: process.env.FBR_PROD_TOKEN || '',
      posId: process.env.FBR_PROD_POSID || '',
    },
  },
  
  posFeeEnabled: process.env.POS_FEE_ENABLED === 'true',
  posFeeAmount: parseInt(process.env.POS_FEE_AMOUNT || '100', 10),
  
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  rateLimitWindow: process.env.RATE_LIMIT_WINDOW || '1 minute',
};

export function getFBRConfig() {
  return config.fbr.environment === 'production' 
    ? config.fbr.production 
    : config.fbr.sandbox;
}
