/**
 * Redis configuration for session management and caching
 * Uses ioredis for robust connection handling
 */
import Redis from 'ioredis';
import { logger } from '../utils/logger';

/**
 * Redis configuration from environment
 */
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => {
    if (times > 10) {
      logger.error('Redis connection failed after 10 retries');
      return null; // Stop retrying
    }
    const delay = Math.min(times * 100, 3000);
    logger.warn(`Redis retry attempt ${times}, waiting ${delay}ms`);
    return delay;
  },
  lazyConnect: true,
};

/**
 * Create Redis URL from environment
 */
function getRedisUrl(): string {
  const url = process.env.REDIS_URL;
  if (url) return url;
  
  const { host, port, password, db } = redisConfig;
  if (password) {
    return `redis://:${password}@${host}:${port}/${db}`;
  }
  return `redis://${host}:${port}/${db}`;
}

/**
 * Redis client instance
 */
export const redis = new Redis(getRedisUrl(), {
  maxRetriesPerRequest: redisConfig.maxRetriesPerRequest,
  retryStrategy: redisConfig.retryStrategy,
  lazyConnect: true,
});

/**
 * Event handlers for Redis connection
 */
redis.on('connect', () => {
  logger.info('Redis client connected');
});

redis.on('ready', () => {
  logger.info('Redis client ready');
});

redis.on('error', (error: Error) => {
  logger.error('Redis client error', { error: error.message });
});

redis.on('close', () => {
  logger.warn('Redis connection closed');
});

redis.on('reconnecting', () => {
  logger.info('Redis client reconnecting');
});

/**
 * Session key prefixes for organization
 */
export const REDIS_KEYS = {
  /** Refresh token storage: refresh_token:{user_id}:{jti} */
  REFRESH_TOKEN: 'refresh_token',
  
  /** Session data: session:{user_id}:{device_id} */
  SESSION: 'session',
  
  /** Rate limiting: rate_limit:{endpoint}:{ip} */
  RATE_LIMIT: 'rate_limit',
  
  /** User sessions list: user_sessions:{user_id} */
  USER_SESSIONS: 'user_sessions',
} as const;

/**
 * Build a Redis key with proper namespacing
 * @param prefix Key prefix from REDIS_KEYS
 * @param parts Additional key parts
 * @returns Formatted Redis key
 */
export function buildRedisKey(prefix: string, ...parts: string[]): string {
  return [prefix, ...parts].join(':');
}

/**
 * Check Redis connectivity
 * @returns Promise<boolean> True if connected successfully
 */
export async function checkRedisConnection(): Promise<boolean> {
  try {
    await redis.connect();
    const pong = await redis.ping();
    logger.info('Redis connection verified', { response: pong });
    return pong === 'PONG';
  } catch (error) {
    logger.error('Redis connection failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return false;
  }
}

/**
 * Close Redis connection gracefully
 */
export async function closeRedisConnection(): Promise<void> {
  await redis.quit();
  logger.info('Redis connection closed');
}

/**
 * Session data structure stored in Redis
 */
export interface SessionData {
  userId: string;
  deviceId: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
}

/**
 * Store session data in Redis
 * @param userId User ID
 * @param deviceId Device identifier
 * @param data Session data
 * @param ttlSeconds Time to live in seconds
 */
export async function storeSession(
  userId: string,
  deviceId: string,
  data: SessionData,
  ttlSeconds: number
): Promise<void> {
  const key = buildRedisKey(REDIS_KEYS.SESSION, userId, deviceId);
  await redis.setex(key, ttlSeconds, JSON.stringify(data));
  
  // Track session in user's session list
  const userSessionsKey = buildRedisKey(REDIS_KEYS.USER_SESSIONS, userId);
  await redis.sadd(userSessionsKey, deviceId);
  await redis.expire(userSessionsKey, ttlSeconds);
}

/**
 * Get session data from Redis
 * @param userId User ID
 * @param deviceId Device identifier
 * @returns Session data or null if not found
 */
export async function getSession(
  userId: string,
  deviceId: string
): Promise<SessionData | null> {
  const key = buildRedisKey(REDIS_KEYS.SESSION, userId, deviceId);
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}

/**
 * Delete a specific session
 * @param userId User ID
 * @param deviceId Device identifier
 */
export async function deleteSession(userId: string, deviceId: string): Promise<void> {
  const key = buildRedisKey(REDIS_KEYS.SESSION, userId, deviceId);
  await redis.del(key);
  
  // Remove from user's session list
  const userSessionsKey = buildRedisKey(REDIS_KEYS.USER_SESSIONS, userId);
  await redis.srem(userSessionsKey, deviceId);
}

/**
 * Delete all sessions for a user (logout from all devices)
 * @param userId User ID
 */
export async function deleteAllUserSessions(userId: string): Promise<void> {
  const userSessionsKey = buildRedisKey(REDIS_KEYS.USER_SESSIONS, userId);
  const deviceIds = await redis.smembers(userSessionsKey);
  
  // Delete all session keys
  const pipeline = redis.pipeline();
  for (const deviceId of deviceIds) {
    const sessionKey = buildRedisKey(REDIS_KEYS.SESSION, userId, deviceId);
    pipeline.del(sessionKey);
  }
  pipeline.del(userSessionsKey);
  await pipeline.exec();
}
