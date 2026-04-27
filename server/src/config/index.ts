import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/alc',
  jwtSecret: process.env.JWT_SECRET || 'alc_jwt_secret_key_2026',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'alc_jwt_refresh_secret_2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  redisHost: process.env.REDIS_HOST || 'localhost',
  redisPort: parseInt(process.env.REDIS_PORT || '6379', 10),
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000,http://localhost:8081,http://localhost:19006').split(','),
};
