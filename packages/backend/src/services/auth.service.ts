/**
 * Authentication service
 * Handles user registration, login, logout, and token refresh
 */
import { eq, and, isNull } from 'drizzle-orm';

import {
  issueTokens,
  rotateRefreshToken,
  logout as logoutToken,
  revokeAllUserTokens,
  generateDeviceId,
} from './token.service';
import { db } from '../config/database';
import { type TokenPair } from '../config/jwt';
import { users, type User, type NewUser } from '../db/schema';
import { AuthenticationError, ConflictError, NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';
import { hashPassword, verifyPassword, needsRehash } from '../utils/password';

/**
 * Registration input data
 */
export interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
}

/**
 * Login input data
 */
export interface LoginInput {
  email: string;
  password: string;
}

/**
 * Request metadata for session tracking
 */
export interface RequestMeta {
  ipAddress: string;
  userAgent: string;
}

/**
 * Auth response with user data and tokens
 */
export interface AuthResponse {
  user: {
    id: string;
    email: string;
    fullName: string;
    role: 'user' | 'admin';
    emailVerified: boolean;
    createdAt: Date;
  };
  tokens: TokenPair;
}

/**
 * Find user by email (case-insensitive, excluding deleted)
 * @param email User email
 * @returns User record or null
 */
export async function findUserByEmail(email: string): Promise<User | null> {
  const normalizedEmail = email.toLowerCase().trim();

  const result = await db
    .select()
    .from(users)
    .where(and(eq(users.email, normalizedEmail), isNull(users.deletedAt)))
    .limit(1);

  return result[0] || null;
}

/**
 * Find user by ID (excluding deleted)
 * @param id User ID
 * @returns User record or null
 */
export async function findUserById(id: string): Promise<User | null> {
  const result = await db
    .select()
    .from(users)
    .where(and(eq(users.id, id), isNull(users.deletedAt)))
    .limit(1);

  return result[0] || null;
}

/**
 * Register a new user
 * @param input Registration data
 * @param meta Request metadata
 * @returns Auth response with user and tokens
 * @throws ConflictError if email already exists
 */
export async function register(input: RegisterInput, meta: RequestMeta): Promise<AuthResponse> {
  const normalizedEmail = input.email.toLowerCase().trim();

  // Check if email already exists
  const existingUser = await findUserByEmail(normalizedEmail);
  if (existingUser) {
    logger.warn('Registration attempt with existing email', {
      email: normalizedEmail,
      ipAddress: meta.ipAddress,
    });
    throw new ConflictError('A user with this email already exists');
  }

  // Hash password
  const passwordHash = await hashPassword(input.password);

  // Insert new user
  const newUserData: NewUser = {
    email: normalizedEmail,
    passwordHash,
    fullName: input.fullName.trim(),
    role: 'user',
    emailVerified: false,
  };

  const result = await db.insert(users).values(newUserData).returning();

  const newUser = result[0];
  if (!newUser) {
    throw new Error('Failed to create user');
  }

  logger.info('New user registered', {
    userId: newUser.id,
    email: normalizedEmail,
    ipAddress: meta.ipAddress,
  });

  // Generate device ID and issue tokens
  const deviceId = generateDeviceId(meta.userAgent, meta.ipAddress);
  const tokens = await issueTokens(
    newUser.id,
    newUser.email,
    newUser.role,
    deviceId,
    meta.ipAddress,
    meta.userAgent
  );

  return {
    user: {
      id: newUser.id,
      email: newUser.email,
      fullName: newUser.fullName,
      role: newUser.role,
      emailVerified: newUser.emailVerified,
      createdAt: newUser.createdAt,
    },
    tokens,
  };
}

/**
 * Login user with email and password
 * @param input Login credentials
 * @param meta Request metadata
 * @returns Auth response with user and tokens
 * @throws AuthenticationError if credentials are invalid
 */
export async function login(input: LoginInput, meta: RequestMeta): Promise<AuthResponse> {
  const normalizedEmail = input.email.toLowerCase().trim();

  // Find user by email
  const user = await findUserByEmail(normalizedEmail);
  if (!user) {
    logger.warn('Login attempt for non-existent user', {
      email: normalizedEmail,
      ipAddress: meta.ipAddress,
    });
    // Use generic error to prevent email enumeration
    throw new AuthenticationError('Invalid credentials');
  }

  // Verify password
  const isValidPassword = await verifyPassword(user.passwordHash, input.password);
  if (!isValidPassword) {
    logger.warn('Login attempt with invalid password', {
      userId: user.id,
      email: normalizedEmail,
      ipAddress: meta.ipAddress,
    });
    throw new AuthenticationError('Invalid credentials');
  }

  // Check if password needs rehashing (config changed)
  if (await needsRehash(user.passwordHash)) {
    const newHash = await hashPassword(input.password);
    await db
      .update(users)
      .set({
        passwordHash: newHash,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    logger.info('Password rehashed for user', { userId: user.id });
  }

  // Update last login timestamp
  await db.update(users).set({ updatedAt: new Date() }).where(eq(users.id, user.id));

  // Generate device ID and issue tokens
  const deviceId = generateDeviceId(meta.userAgent, meta.ipAddress);
  const tokens = await issueTokens(
    user.id,
    user.email,
    user.role,
    deviceId,
    meta.ipAddress,
    meta.userAgent
  );

  logger.info('User logged in', {
    userId: user.id,
    email: normalizedEmail,
    ipAddress: meta.ipAddress,
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    },
    tokens,
  };
}

/**
 * Refresh access token using refresh token
 * @param refreshToken Current refresh token
 * @param meta Request metadata
 * @returns New token pair
 * @throws AuthenticationError if refresh token is invalid
 */
export async function refresh(refreshToken: string, meta: RequestMeta): Promise<TokenPair> {
  // Verify refresh token and get user info
  const { verifyRefreshToken } = await import('../config/jwt');
  const payload = verifyRefreshToken(refreshToken);

  if (!payload) {
    throw new AuthenticationError('Invalid refresh token');
  }

  // Get user from database to ensure they still exist and get current role
  const user = await findUserById(payload.sub);
  if (!user) {
    logger.warn('Refresh attempt for deleted user', { userId: payload.sub });
    throw new AuthenticationError('Invalid refresh token');
  }

  // Rotate refresh token
  const newTokens = await rotateRefreshToken(
    refreshToken,
    user.email,
    user.role,
    meta.ipAddress,
    meta.userAgent
  );

  if (!newTokens) {
    throw new AuthenticationError('Invalid refresh token');
  }

  logger.info('Token refreshed', {
    userId: user.id,
    ipAddress: meta.ipAddress,
  });

  return newTokens;
}

/**
 * Logout user by invalidating their refresh token
 * @param refreshToken Refresh token to invalidate
 * @returns True if logout successful
 */
export async function logout(refreshToken: string): Promise<boolean> {
  const success = await logoutToken(refreshToken);

  if (!success) {
    logger.warn('Logout attempt with invalid refresh token');
  }

  return success;
}

/**
 * Logout user from all devices
 * @param userId User ID
 */
export async function logoutAll(userId: string): Promise<void> {
  await revokeAllUserTokens(userId);
  logger.info('User logged out from all devices', { userId });
}

/**
 * Get user profile by ID
 * @param userId User ID
 * @returns User profile data
 * @throws NotFoundError if user not found
 */
export async function getProfile(userId: string): Promise<Omit<User, 'passwordHash'>> {
  const user = await findUserById(userId);

  if (!user) {
    throw new NotFoundError('User');
  }

  // Remove password hash from response
  const { passwordHash: _, ...profile } = user;
  return profile;
}
