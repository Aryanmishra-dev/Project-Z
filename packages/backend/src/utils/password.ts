/**
 * Password hashing utilities using Argon2id
 * Implements secure password hashing according to OWASP guidelines
 */
import argon2, { type Options } from 'argon2';
import { logger } from './logger';

/**
 * Argon2id configuration following OWASP recommendations
 * Memory: 65536 KB (64 MB)
 * Iterations: 3
 * Parallelism: 4
 */
const ARGON2_CONFIG = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MB
  timeCost: 3,       // 3 iterations
  parallelism: 4,    // 4 parallel threads
  hashLength: 32,    // 32 bytes output
} as const;

/**
 * Hash a password using Argon2id
 * @param password Plain text password to hash
 * @returns Promise resolving to the hashed password
 * @throws Error if hashing fails
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    const hash = await argon2.hash(password, ARGON2_CONFIG);
    logger.debug('Password hashed successfully');
    return hash;
  } catch (error) {
    logger.error('Password hashing failed', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    throw new Error('Failed to hash password');
  }
}

/**
 * Verify a password against a hash
 * @param hash The stored password hash
 * @param password The plain text password to verify
 * @returns Promise resolving to true if password matches, false otherwise
 */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    const isValid = await argon2.verify(hash, password);
    logger.debug('Password verification completed', { isValid });
    return isValid;
  } catch (error) {
    logger.error('Password verification failed', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    return false;
  }
}

/**
 * Check if a hash needs rehashing (e.g., if parameters have changed)
 * @param hash The stored password hash
 * @returns Promise resolving to true if rehash is needed
 */
export async function needsRehash(hash: string): Promise<boolean> {
  try {
    return argon2.needsRehash(hash, ARGON2_CONFIG);
  } catch (error) {
    logger.warn('Rehash check failed, assuming rehash needed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return true;
  }
}

/**
 * Password validation rules
 */
export const PASSWORD_RULES = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: true,
  specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
};

/**
 * Validate password strength
 * @param password Password to validate
 * @returns Object with isValid boolean and array of error messages
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < PASSWORD_RULES.minLength) {
    errors.push(`Password must be at least ${PASSWORD_RULES.minLength} characters long`);
  }

  if (PASSWORD_RULES.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (PASSWORD_RULES.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (PASSWORD_RULES.requireNumber && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (PASSWORD_RULES.requireSpecial) {
    const specialRegex = new RegExp(`[${PASSWORD_RULES.specialChars.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}]`);
    if (!specialRegex.test(password)) {
      errors.push('Password must contain at least one special character');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
