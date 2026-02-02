/**
 * JWT utility tests
 * Tests for JWT token generation and verification
 */
import { describe, it, expect, vi } from 'vitest';

// Mock environment before importing
vi.stubEnv('JWT_SECRET', 'test-secret-key-for-jwt-testing-min-32-chars');
vi.stubEnv('JWT_ACCESS_EXPIRES', '15m');
vi.stubEnv('JWT_REFRESH_EXPIRES', '7d');

import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateTokenPair,
  parseExpiry,
} from '../../src/config/jwt';

describe('JWT Utilities', () => {
  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
  const mockEmail = 'test@example.com';
  const mockRole = 'user' as const;
  const mockDeviceId = 'device-123';

  describe('parseExpiry', () => {
    it('should parse minutes correctly', () => {
      expect(parseExpiry('15m')).toBe(15 * 60); // Returns seconds
      expect(parseExpiry('1m')).toBe(60);
      expect(parseExpiry('60m')).toBe(60 * 60);
    });

    it('should parse hours correctly', () => {
      expect(parseExpiry('1h')).toBe(60 * 60);
      expect(parseExpiry('24h')).toBe(24 * 60 * 60);
    });

    it('should parse days correctly', () => {
      expect(parseExpiry('1d')).toBe(24 * 60 * 60);
      expect(parseExpiry('7d')).toBe(7 * 24 * 60 * 60);
      expect(parseExpiry('30d')).toBe(30 * 24 * 60 * 60);
    });

    it('should default to 900 seconds for invalid format', () => {
      expect(parseExpiry('invalid')).toBe(900); // 15 minutes in seconds
      expect(parseExpiry('')).toBe(900);
    });
  });

  describe('generateAccessToken', () => {
    it('should generate a valid access token', () => {
      const token = generateAccessToken(mockUserId, mockEmail, mockRole);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should include correct payload', () => {
      const token = generateAccessToken(mockUserId, mockEmail, mockRole);

      const payload = verifyAccessToken(token);
      expect(payload).not.toBeNull();
      expect(payload?.sub).toBe(mockUserId);
      expect(payload?.email).toBe(mockEmail);
      expect(payload?.role).toBe(mockRole);
      expect(payload?.type).toBe('access');
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token', () => {
      const result = generateRefreshToken(mockUserId, mockDeviceId);

      expect(result).toBeDefined();
      expect(result.token).toBeDefined();
      expect(result.jti).toBeDefined();
      expect(typeof result.token).toBe('string');
      expect(result.token.split('.')).toHaveLength(3);
    });

    it('should include correct payload', () => {
      const result = generateRefreshToken(mockUserId, mockDeviceId);

      const payload = verifyRefreshToken(result.token);
      expect(payload).not.toBeNull();
      expect(payload?.sub).toBe(mockUserId);
      expect(payload?.jti).toBe(result.jti);
      expect(payload?.deviceId).toBe(mockDeviceId);
      expect(payload?.type).toBe('refresh');
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify valid access token', () => {
      const token = generateAccessToken(mockUserId, mockEmail, mockRole);

      const payload = verifyAccessToken(token);
      expect(payload).not.toBeNull();
      expect(payload?.sub).toBe(mockUserId);
    });

    it('should return null for invalid token', () => {
      const payload = verifyAccessToken('invalid-token');
      expect(payload).toBeNull();
    });

    it('should return null for refresh token', () => {
      const { token: refreshToken } = generateRefreshToken(mockUserId, mockDeviceId);

      const payload = verifyAccessToken(refreshToken);
      expect(payload).toBeNull();
    });

    it('should return null for tampered token', () => {
      const token = generateAccessToken(mockUserId, mockEmail, mockRole);

      const tamperedToken = token.slice(0, -5) + 'xxxxx';
      const payload = verifyAccessToken(tamperedToken);
      expect(payload).toBeNull();
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify valid refresh token', () => {
      const result = generateRefreshToken(mockUserId, mockDeviceId);

      const payload = verifyRefreshToken(result.token);
      expect(payload).not.toBeNull();
      expect(payload?.sub).toBe(mockUserId);
      expect(payload?.jti).toBe(result.jti);
    });

    it('should return null for invalid token', () => {
      const payload = verifyRefreshToken('invalid-token');
      expect(payload).toBeNull();
    });

    it('should return null for access token', () => {
      const accessToken = generateAccessToken(mockUserId, mockEmail, mockRole);

      const payload = verifyRefreshToken(accessToken);
      expect(payload).toBeNull();
    });
  });

  describe('generateTokenPair', () => {
    it('should generate both access and refresh tokens', () => {
      const tokens = generateTokenPair(mockUserId, mockEmail, mockRole, mockDeviceId);

      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(tokens.jti).toBeDefined();
      expect(tokens.accessToken).not.toBe(tokens.refreshToken);
    });

    it('should generate verifiable tokens', () => {
      const tokens = generateTokenPair(mockUserId, mockEmail, mockRole, mockDeviceId);

      const accessPayload = verifyAccessToken(tokens.accessToken);
      const refreshPayload = verifyRefreshToken(tokens.refreshToken);

      expect(accessPayload?.sub).toBe(mockUserId);
      expect(refreshPayload?.sub).toBe(mockUserId);
      expect(refreshPayload?.jti).toBe(tokens.jti);
    });
  });
});
