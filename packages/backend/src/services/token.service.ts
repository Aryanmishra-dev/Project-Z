/**
 * Token service for JWT and refresh token management
 * Handles token storage, validation, and rotation in Redis
 */
import {
  redis,
  buildRedisKey,
  REDIS_KEYS,
  storeSession,
  deleteSession,
  deleteAllUserSessions,
  type SessionData,
} from '../config/redis';
import {
  generateTokenPair,
  verifyRefreshToken,
  getRefreshTokenExpirySeconds,
  type TokenPair,
  type RefreshTokenPayload,
} from '../config/jwt';
import { logger } from '../utils/logger';

/**
 * Refresh token data stored in Redis
 */
interface StoredRefreshToken {
  userId: string;
  deviceId: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  expiresAt: string;
}

/**
 * Generate a device ID from request headers
 * @param userAgent User-Agent header
 * @param ipAddress Client IP address
 * @returns Generated device identifier
 */
export function generateDeviceId(userAgent: string, ipAddress: string): string {
  // Create a semi-stable device ID based on request characteristics
  const data = `${userAgent}-${ipAddress}`;
  // Simple hash - in production, use a proper hashing function
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `device_${Math.abs(hash).toString(16)}`;
}

/**
 * Issue a new token pair and store refresh token in Redis
 * @param userId User ID
 * @param email User email
 * @param role User role
 * @param deviceId Device identifier
 * @param ipAddress Client IP address
 * @param userAgent User-Agent header
 * @returns Token pair with access and refresh tokens
 */
export async function issueTokens(
  userId: string,
  email: string,
  role: 'user' | 'admin',
  deviceId: string,
  ipAddress: string,
  userAgent: string
): Promise<TokenPair> {
  const { accessToken, refreshToken, expiresIn, tokenType, jti } = generateTokenPair(
    userId,
    email,
    role,
    deviceId
  );

  const ttlSeconds = getRefreshTokenExpirySeconds();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

  // Store refresh token in Redis
  const refreshTokenKey = buildRedisKey(REDIS_KEYS.REFRESH_TOKEN, userId, jti);
  const tokenData: StoredRefreshToken = {
    userId,
    deviceId,
    ipAddress,
    userAgent,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
  
  await redis.setex(refreshTokenKey, ttlSeconds, JSON.stringify(tokenData));

  // Store session data
  const sessionData: SessionData = {
    userId,
    deviceId,
    ipAddress,
    userAgent,
    createdAt: now.toISOString(),
    lastActiveAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
  
  await storeSession(userId, deviceId, sessionData, ttlSeconds);

  logger.info('Tokens issued successfully', { userId, deviceId });

  return {
    accessToken,
    refreshToken,
    expiresIn,
    tokenType,
  };
}

/**
 * Verify and get stored refresh token data
 * @param refreshToken Refresh token to verify
 * @returns Stored token data or null if invalid
 */
export async function verifyStoredRefreshToken(
  refreshToken: string
): Promise<{ payload: RefreshTokenPayload; stored: StoredRefreshToken } | null> {
  // Verify JWT signature and expiry
  const payload = verifyRefreshToken(refreshToken);
  if (!payload) {
    logger.debug('Refresh token JWT verification failed');
    return null;
  }

  // Check if token exists in Redis (not revoked)
  const refreshTokenKey = buildRedisKey(REDIS_KEYS.REFRESH_TOKEN, payload.sub, payload.jti);
  const storedData = await redis.get(refreshTokenKey);
  
  if (!storedData) {
    logger.warn('Refresh token not found in Redis (possibly revoked)', {
      userId: payload.sub,
      jti: payload.jti,
    });
    return null;
  }

  const stored: StoredRefreshToken = JSON.parse(storedData);

  // Verify device ID matches
  if (stored.deviceId !== payload.deviceId) {
    logger.warn('Refresh token device ID mismatch', {
      userId: payload.sub,
      expected: stored.deviceId,
      received: payload.deviceId,
    });
    return null;
  }

  return { payload, stored };
}

/**
 * Rotate refresh token - invalidate old token and issue new pair
 * @param oldRefreshToken Current refresh token
 * @param email User email (for new access token)
 * @param role User role
 * @param ipAddress Current IP address
 * @param userAgent Current User-Agent
 * @returns New token pair or null if rotation fails
 */
export async function rotateRefreshToken(
  oldRefreshToken: string,
  email: string,
  role: 'user' | 'admin',
  ipAddress: string,
  userAgent: string
): Promise<TokenPair | null> {
  const verification = await verifyStoredRefreshToken(oldRefreshToken);
  if (!verification) {
    return null;
  }

  const { payload, stored } = verification;

  // Invalidate old refresh token
  const oldTokenKey = buildRedisKey(REDIS_KEYS.REFRESH_TOKEN, payload.sub, payload.jti);
  await redis.del(oldTokenKey);

  logger.info('Old refresh token invalidated', { 
    userId: payload.sub, 
    jti: payload.jti 
  });

  // Issue new token pair
  return issueTokens(
    payload.sub,
    email,
    role,
    stored.deviceId, // Keep same device ID
    ipAddress,
    userAgent
  );
}

/**
 * Revoke a specific refresh token
 * @param userId User ID
 * @param jti Token ID to revoke
 */
export async function revokeRefreshToken(userId: string, jti: string): Promise<void> {
  const tokenKey = buildRedisKey(REDIS_KEYS.REFRESH_TOKEN, userId, jti);
  await redis.del(tokenKey);
  logger.info('Refresh token revoked', { userId, jti });
}

/**
 * Revoke all refresh tokens for a user
 * @param userId User ID
 */
export async function revokeAllUserTokens(userId: string): Promise<void> {
  // Find all refresh tokens for user
  const pattern = buildRedisKey(REDIS_KEYS.REFRESH_TOKEN, userId, '*');
  const keys = await redis.keys(pattern);
  
  if (keys.length > 0) {
    await redis.del(...keys);
  }

  // Also clear all sessions
  await deleteAllUserSessions(userId);

  logger.info('All user tokens revoked', { userId, tokensRevoked: keys.length });
}

/**
 * Logout - revoke specific session and token
 * @param refreshToken Refresh token to invalidate
 */
export async function logout(refreshToken: string): Promise<boolean> {
  const verification = await verifyStoredRefreshToken(refreshToken);
  if (!verification) {
    return false;
  }

  const { payload, stored } = verification;

  // Delete refresh token
  const tokenKey = buildRedisKey(REDIS_KEYS.REFRESH_TOKEN, payload.sub, payload.jti);
  await redis.del(tokenKey);

  // Delete session
  await deleteSession(payload.sub, stored.deviceId);

  logger.info('User logged out', { userId: payload.sub, deviceId: stored.deviceId });
  return true;
}

/**
 * Get active session count for a user
 * @param userId User ID
 * @returns Number of active sessions
 */
export async function getActiveSessionCount(userId: string): Promise<number> {
  const userSessionsKey = buildRedisKey(REDIS_KEYS.USER_SESSIONS, userId);
  return redis.scard(userSessionsKey);
}
