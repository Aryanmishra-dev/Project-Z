/**
 * JWT configuration and utilities
 * Handles token generation, verification, and rotation
 */
import jwt, { SignOptions, JwtPayload } from 'jsonwebtoken';
import crypto from 'crypto';
import { logger } from '../utils/logger';

/**
 * JWT configuration from environment variables
 */
export const jwtConfig = {
  /** Secret for signing access tokens */
  accessSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
  
  /** Secret for signing refresh tokens */
  refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-change-in-production',
  
  /** Access token expiry (default: 15 minutes) */
  accessExpiresIn: (process.env.JWT_EXPIRES_IN || '15m') as string,
  
  /** Refresh token expiry (default: 7 days) */
  refreshExpiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as string,
  
  /** Token issuer */
  issuer: 'pdf-quiz-generator',
  
  /** Token audience */
  audience: 'pdf-quiz-generator-api',
  
  /** Algorithm for signing */
  algorithm: 'HS256' as const,
};

/**
 * Generate a UUID v4 using crypto
 */
function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Access token payload structure
 */
export interface AccessTokenPayload extends JwtPayload {
  /** User ID (subject) */
  sub: string;
  
  /** User email */
  email: string;
  
  /** User role */
  role: 'user' | 'admin';
  
  /** Token type identifier */
  type: 'access';
}

/**
 * Refresh token payload structure
 */
export interface RefreshTokenPayload extends JwtPayload {
  /** User ID (subject) */
  sub: string;
  
  /** JWT ID for tracking/revocation */
  jti: string;
  
  /** Device identifier */
  deviceId: string;
  
  /** Token type identifier */
  type: 'refresh';
}

/**
 * Token pair returned after authentication
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

/**
 * Generate an access token for a user
 * @param userId User ID
 * @param email User email
 * @param role User role
 * @returns Signed access token
 */
export function generateAccessToken(
  userId: string,
  email: string,
  role: 'user' | 'admin'
): string {
  const payload: Omit<AccessTokenPayload, 'iat' | 'exp'> = {
    sub: userId,
    email,
    role,
    type: 'access',
  };

  const options: SignOptions = {
    expiresIn: jwtConfig.accessExpiresIn as jwt.SignOptions['expiresIn'],
    issuer: jwtConfig.issuer,
    audience: jwtConfig.audience,
    algorithm: jwtConfig.algorithm,
  };

  return jwt.sign(payload, jwtConfig.accessSecret, options)
}

/**
 * Generate a refresh token for a user
 * @param userId User ID
 * @param deviceId Device identifier
 * @returns Object containing token and JTI
 */
export function generateRefreshToken(
  userId: string,
  deviceId: string
): { token: string; jti: string } {
  const jti = generateUUID();
  
  const payload: Omit<RefreshTokenPayload, 'iat' | 'exp'> = {
    sub: userId,
    jti,
    deviceId,
    type: 'refresh',
  };

  const options: SignOptions = {
    expiresIn: jwtConfig.refreshExpiresIn as jwt.SignOptions['expiresIn'],
    issuer: jwtConfig.issuer,
    audience: jwtConfig.audience,
    algorithm: jwtConfig.algorithm,
  };

  const token = jwt.sign(payload, jwtConfig.refreshSecret, options);
  return { token, jti };
}

/**
 * Generate a complete token pair for authentication
 * @param userId User ID
 * @param email User email
 * @param role User role
 * @param deviceId Device identifier
 * @returns Token pair with access and refresh tokens
 */
export function generateTokenPair(
  userId: string,
  email: string,
  role: 'user' | 'admin',
  deviceId: string
): TokenPair & { jti: string } {
  const accessToken = generateAccessToken(userId, email, role);
  const { token: refreshToken, jti } = generateRefreshToken(userId, deviceId);
  
  // Calculate expiry in seconds
  const expiresIn = parseExpiry(jwtConfig.accessExpiresIn);
  
  return {
    accessToken,
    refreshToken,
    expiresIn,
    tokenType: 'Bearer',
    jti,
  };
}

/**
 * Verify and decode an access token
 * @param token Access token to verify
 * @returns Decoded payload or null if invalid
 */
export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, jwtConfig.accessSecret, {
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience,
      algorithms: [jwtConfig.algorithm],
    }) as AccessTokenPayload;

    if (decoded.type !== 'access') {
      logger.warn('Invalid token type for access token', { type: decoded.type });
      return null;
    }

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.debug('Access token expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('Invalid access token', { 
        error: error.message 
      });
    }
    return null;
  }
}

/**
 * Verify and decode a refresh token
 * @param token Refresh token to verify
 * @returns Decoded payload or null if invalid
 */
export function verifyRefreshToken(token: string): RefreshTokenPayload | null {
  try {
    const decoded = jwt.verify(token, jwtConfig.refreshSecret, {
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience,
      algorithms: [jwtConfig.algorithm],
    }) as RefreshTokenPayload;

    if (decoded.type !== 'refresh') {
      logger.warn('Invalid token type for refresh token', { type: decoded.type });
      return null;
    }

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.debug('Refresh token expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('Invalid refresh token', { 
        error: error.message 
      });
    }
    return null;
  }
}

/**
 * Parse JWT expiry string to seconds
 * @param expiry Expiry string (e.g., '15m', '7d')
 * @returns Expiry in seconds
 */
export function parseExpiry(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match || !match[1] || !match[2]) {
    logger.warn('Invalid expiry format, defaulting to 900s', { expiry });
    return 900; // 15 minutes default
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 60 * 60;
    case 'd': return value * 60 * 60 * 24;
    default: return 900;
  }
}

/**
 * Get refresh token expiry in seconds
 * @returns Expiry in seconds
 */
export function getRefreshTokenExpirySeconds(): number {
  return parseExpiry(jwtConfig.refreshExpiresIn);
}
