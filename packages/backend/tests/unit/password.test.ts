/**
 * Password utility tests
 * Tests for Argon2id password hashing and validation
 */
import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  needsRehash,
  validatePasswordStrength,
  PASSWORD_RULES,
} from '../../src/utils/password';

describe('Password Utilities', () => {
  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.startsWith('$argon2id$')).toBe(true);
    });

    it('should produce different hashes for same password', async () => {
      const password = 'TestPassword123!';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty password', async () => {
      const hash = await hashPassword('');
      expect(hash).toBeDefined();
      expect(hash.startsWith('$argon2id$')).toBe(true);
    });

    it('should handle long passwords', async () => {
      const password = 'A'.repeat(128);
      const hash = await hashPassword(password);
      expect(hash).toBeDefined();
    });

    it('should handle unicode characters', async () => {
      const password = 'пароль密码🔐Test123!';
      const hash = await hashPassword(password);
      expect(hash).toBeDefined();
      
      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);
      
      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);
      
      const isValid = await verifyPassword('WrongPassword123!', hash);
      expect(isValid).toBe(false);
    });

    it('should reject similar but different password', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);
      
      const isValid = await verifyPassword('TestPassword123', hash);
      expect(isValid).toBe(false);
    });

    it('should reject case-different password', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);
      
      const isValid = await verifyPassword('testpassword123!', hash);
      expect(isValid).toBe(false);
    });

    it('should handle invalid hash format', async () => {
      await expect(verifyPassword('password', 'invalid-hash')).rejects.toThrow();
    });
  });

  describe('needsRehash', () => {
    it('should return false for recently hashed password', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);
      
      const needs = await needsRehash(hash);
      expect(needs).toBe(false);
    });

    it('should handle hash from older parameters', async () => {
      // A hash with different parameters would need rehash
      // For now, test that the function works with valid hash
      const hash = await hashPassword('test');
      const needs = await needsRehash(hash);
      expect(typeof needs).toBe('boolean');
    });
  });

  describe('validatePasswordStrength', () => {
    it('should validate strong password', () => {
      const result = validatePasswordStrength('StrongP@ss123');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject short password', () => {
      const result = validatePasswordStrength('Sh@rt1');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters');
    });

    it('should reject password without uppercase', () => {
      const result = validatePasswordStrength('lowercase123!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should reject password without lowercase', () => {
      const result = validatePasswordStrength('UPPERCASE123!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should reject password without digit', () => {
      const result = validatePasswordStrength('NoDigits!@#');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one digit');
    });

    it('should reject password without special character', () => {
      const result = validatePasswordStrength('NoSpecial123');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one special character');
    });

    it('should return multiple errors for weak password', () => {
      const result = validatePasswordStrength('weak');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });

    it('should accept password at minimum length', () => {
      const result = validatePasswordStrength('Ab1!abcd');
      expect(result.isValid).toBe(true);
    });
  });

  describe('PASSWORD_RULES', () => {
    it('should have correct minimum length', () => {
      expect(PASSWORD_RULES.minLength).toBe(8);
    });

    it('should require all character types', () => {
      expect(PASSWORD_RULES.requireUppercase).toBe(true);
      expect(PASSWORD_RULES.requireLowercase).toBe(true);
      expect(PASSWORD_RULES.requireNumber).toBe(true);
      expect(PASSWORD_RULES.requireSpecial).toBe(true);
    });
  });
});
