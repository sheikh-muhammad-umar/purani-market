export default () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiPrefix: process.env.API_PREFIX || 'api',

  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/marketplace',
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },

  elasticsearch: {
    node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
    username: process.env.ELASTICSEARCH_USERNAME || undefined,
    password: process.env.ELASTICSEARCH_PASSWORD || undefined,
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'your-jwt-secret-change-in-production',
    accessExpiration: process.env.JWT_ACCESS_EXPIRATION || '15m',
    refreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
  },

  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL || '900000', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT || '10', 10),
  },

  cors: {
    allowedOrigins:
      process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:4200',
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    mapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '',
  },

  facebook: {
    appId: process.env.FACEBOOK_APP_ID || '',
    appSecret: process.env.FACEBOOK_APP_SECRET || '',
  },

  apiKey: process.env.API_KEY || '',
});
