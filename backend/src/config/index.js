require('dotenv').config();

function buildRedisUrl() {
  const restUrl = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!restUrl || !token) return null;
  // Extract host from url (remove https://)
  const host = restUrl.replace('https://', '').replace(/\/$/, '');
  return `rediss://default:${token}@${host}:6379`;
}

// Two independent HMAC secrets for access and refresh tokens. Falling back to
// a single secret makes both tokens forgeable from one another.
const accessSecret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;

module.exports = {
  pgliteDbDir: process.env.PGLITE_DB_DIR,
  port: parseInt(process.env.PORT, 10) || 5000,
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV,
  databaseUrl: process.env.DATABASE_URL,
  jwt: {
    secret: accessSecret,
    refreshSecret,
    // Access tokens are short (15m); refresh tokens are long (7d). They are
    // configured independently so operators can tune them separately.
    accessExpiry: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  csrfSecret: process.env.CSRF_SECRET,
  apiKey: process.env.API_KEY,
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 5242880,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  redisUrl: buildRedisUrl(),
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  },
  fast2sms: {
    apiKey: process.env.FAST2SMS_API_KEY,
  },
  ai: {
    fastapiUrl: process.env.FASTAPI_URL,
    timeout: parseInt(process.env.AI_TIMEOUT, 10) || 25000,
    groqKey: process.env.GROQ_API_KEY,
    openaiKey: process.env.OPENAI_API_KEY,
    geminiKey: process.env.GEMINI_API_KEY,
    deepseekKey: process.env.DEEPSEEK_API_KEY,
    deepseekBaseUrl: process.env.DEEPSEEK_BASE_URL,
    huggingfaceToken: process.env.HUGGINGFACE_TOKEN,
    anthropicKey: process.env.ANTHROPIC_API_KEY,
  },
  uptoskills: {
    baseUrl: process.env.UPTOSKILLS_BASE_URL || '',
    apiKey: process.env.UPTOSKILLS_API_KEY || '',
  },
  email: {
    // Resend.com is the email provider. Get a free API key at resend.com.
    // Free tier: 3,000 emails/month, 100 emails/day — plenty for a hobby project.
    resendApiKey: process.env.RESEND_API_KEY,
    from: process.env.EMAIL_FROM || 'noreply@quintern.com',
    retryMax: parseInt(process.env.EMAIL_RETRY_MAX, 10) || 3,
    rateLimitPerRecipient: parseInt(process.env.EMAIL_RATE_LIMIT, 10) || 5,
    rateLimitWindowMs: parseInt(process.env.EMAIL_RATE_WINDOW, 10) || 60000,
  },
  appUrl: process.env.APP_URL || 'http://localhost:5173',
  isProduction: process.env.NODE_ENV === 'production',
  rateLimit: {
    global: parseInt(process.env.RATE_LIMIT_GLOBAL, 10) || 1000,
    auth: parseInt(process.env.RATE_LIMIT_AUTH, 10) || 10,
  },
};
