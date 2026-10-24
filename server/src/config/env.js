// Environment configuration. All secrets come from the environment only.
// Never hardcode credentials here; see .env.example for the full list.
export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL || '',
  sessionSecret: process.env.SESSION_SECRET || 'dev-only-secret-change-me',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  appUrl: process.env.APP_URL || 'http://localhost:5173',
  emailFrom: process.env.EMAIL_FROM || 'NOVARA Commerce <no-reply@example.com>',
  emailApiKey: process.env.EMAIL_PROVIDER_API_KEY || '',
  storage: {
    endpoint: process.env.STORAGE_ENDPOINT || '',
    bucket: process.env.STORAGE_BUCKET || '',
    accessKey: process.env.STORAGE_ACCESS_KEY || '',
    secretKey: process.env.STORAGE_SECRET_KEY || '',
  },
  gateways: {
    sslcommerz: {
      storeId: process.env.SSLCOMMERZ_STORE_ID || '',
      storePassword: process.env.SSLCOMMERZ_STORE_PASSWORD || '',
    },
    bkash: {
      appKey: process.env.BKASH_APP_KEY || '',
      appSecret: process.env.BKASH_APP_SECRET || '',
      username: process.env.BKASH_USERNAME || '',
      password: process.env.BKASH_PASSWORD || '',
    },
    nagad: {
      merchantId: process.env.NAGAD_MERCHANT_ID || '',
      privateKey: process.env.NAGAD_PRIVATE_KEY || '',
    },
  },
};

export const isProduction = env.nodeEnv === 'production';
