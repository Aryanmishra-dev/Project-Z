/**
 * Configuration module index
 * Exports all configuration utilities
 */

export { db, pool, checkDatabaseConnection, closeDatabaseConnection, schema } from './database';
export {
  redis,
  REDIS_KEYS,
  buildRedisKey,
  checkRedisConnection,
  closeRedisConnection,
  storeSession,
  getSession,
  deleteSession,
  deleteAllUserSessions,
  type SessionData,
} from './redis';
export {
  jwtConfig,
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  parseExpiry,
  getRefreshTokenExpirySeconds,
  type AccessTokenPayload,
  type RefreshTokenPayload,
  type TokenPair,
} from './jwt';

export { swaggerSpec } from './swagger';
