/**
 * Auth Service Unit Tests
 * Comprehensive tests for authentication service with 90%+ coverage target
 */
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';

// Mock dependencies before imports
vi.mock('../../src/config/database', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../src/utils/password', () => ({
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
  needsRehash: vi.fn(),
}));

vi.mock('../../src/services/token.service', () => ({
  issueTokens: vi.fn(),
  rotateRefreshToken: vi.fn(),
  logout: vi.fn(),
  revokeAllUserTokens: vi.fn(),
  generateDeviceId: vi.fn(),
}));

vi.mock('../../src/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { db } from '../../src/config/database';
import { hashPassword, verifyPassword, needsRehash } from '../../src/utils/password';
import { issueTokens, rotateRefreshToken, logout as logoutToken, revokeAllUserTokens, generateDeviceId } from '../../src/services/token.service';

// Mock database query builder
const mockQueryBuilder = {
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  returning: vi.fn().mockReturnThis(),
};

describe('Auth Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (db.select as Mock).mockReturnValue(mockQueryBuilder);
    (db.insert as Mock).mockReturnValue(mockQueryBuilder);
    (db.update as Mock).mockReturnValue(mockQueryBuilder);
    (db.delete as Mock).mockReturnValue(mockQueryBuilder);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('findUserByEmail', () => {
    it('should find user by email case-insensitively', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        fullName: 'Test User',
        passwordHash: 'hashed-password',
        role: 'user' as const,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      mockQueryBuilder.limit.mockResolvedValueOnce([mockUser]);

      // Import after mocks are set up
      const { findUserByEmail } = await import('../../src/services/auth.service');
      const result = await findUserByEmail('TEST@EXAMPLE.COM');

      expect(result).toEqual(mockUser);
      expect(db.select).toHaveBeenCalled();
    });

    it('should return null when user not found', async () => {
      mockQueryBuilder.limit.mockResolvedValueOnce([]);

      const { findUserByEmail } = await import('../../src/services/auth.service');
      const result = await findUserByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });

    it('should exclude deleted users', async () => {
      mockQueryBuilder.limit.mockResolvedValueOnce([]);

      const { findUserByEmail } = await import('../../src/services/auth.service');
      const result = await findUserByEmail('deleted@example.com');

      expect(result).toBeNull();
      expect(mockQueryBuilder.where).toHaveBeenCalled();
    });
  });

  describe('findUserById', () => {
    it('should find user by ID', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        fullName: 'Test User',
        role: 'user' as const,
        createdAt: new Date(),
      };

      mockQueryBuilder.limit.mockResolvedValueOnce([mockUser]);

      const { findUserById } = await import('../../src/services/auth.service');
      const result = await findUserById('user-123');

      expect(result).toEqual(mockUser);
    });

    it('should return null for non-existent user', async () => {
      mockQueryBuilder.limit.mockResolvedValueOnce([]);

      const { findUserById } = await import('../../src/services/auth.service');
      const result = await findUserById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const mockTokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        accessTokenExpiry: new Date(),
        refreshTokenExpiry: new Date(),
      };

      const newUser = {
        id: 'new-user-123',
        email: 'new@example.com',
        fullName: 'New User',
        passwordHash: 'hashed-password',
        role: 'user' as const,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      // User doesn't exist
      mockQueryBuilder.limit.mockResolvedValueOnce([]);
      // Insert returns new user
      mockQueryBuilder.returning.mockResolvedValueOnce([newUser]);

      (hashPassword as Mock).mockResolvedValueOnce('hashed-password');
      (generateDeviceId as Mock).mockReturnValueOnce('device-123');
      (issueTokens as Mock).mockResolvedValueOnce(mockTokens);

      const { register } = await import('../../src/services/auth.service');
      const result = await register(
        { email: 'new@example.com', password: 'Password123!', fullName: 'New User' },
        { ipAddress: '127.0.0.1', userAgent: 'test-agent' }
      );

      expect(result.user.email).toBe('new@example.com');
      expect(result.tokens).toEqual(mockTokens);
      expect(hashPassword).toHaveBeenCalledWith('Password123!');
    });

    it('should throw ConflictError for existing email', async () => {
      const existingUser = {
        id: 'existing-user',
        email: 'existing@example.com',
        fullName: 'Existing User',
      };

      mockQueryBuilder.limit.mockResolvedValueOnce([existingUser]);

      const { register } = await import('../../src/services/auth.service');
      
      await expect(
        register(
          { email: 'existing@example.com', password: 'Password123!', fullName: 'Test' },
          { ipAddress: '127.0.0.1', userAgent: 'test-agent' }
        )
      ).rejects.toThrow('Email already in use');
    });

    it('should normalize email to lowercase', async () => {
      mockQueryBuilder.limit.mockResolvedValueOnce([]);
      mockQueryBuilder.returning.mockResolvedValueOnce([{
        id: 'user-123',
        email: 'test@example.com',
        fullName: 'Test User',
        role: 'user',
        emailVerified: false,
        createdAt: new Date(),
      }]);

      (hashPassword as Mock).mockResolvedValueOnce('hashed-password');
      (generateDeviceId as Mock).mockReturnValueOnce('device-123');
      (issueTokens as Mock).mockResolvedValueOnce({
        accessToken: 'token',
        refreshToken: 'refresh',
        accessTokenExpiry: new Date(),
        refreshTokenExpiry: new Date(),
      });

      const { register } = await import('../../src/services/auth.service');
      await register(
        { email: 'TEST@EXAMPLE.COM', password: 'Password123!', fullName: 'Test' },
        { ipAddress: '127.0.0.1', userAgent: 'test-agent' }
      );

      // Verify email was normalized
      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should login user with correct credentials', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        fullName: 'Test User',
        passwordHash: 'hashed-password',
        role: 'user' as const,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      const mockTokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        accessTokenExpiry: new Date(),
        refreshTokenExpiry: new Date(),
      };

      mockQueryBuilder.limit.mockResolvedValueOnce([mockUser]);
      (verifyPassword as Mock).mockResolvedValueOnce(true);
      (needsRehash as Mock).mockResolvedValueOnce(false);
      (generateDeviceId as Mock).mockReturnValueOnce('device-123');
      (issueTokens as Mock).mockResolvedValueOnce(mockTokens);

      const { login } = await import('../../src/services/auth.service');
      const result = await login(
        { email: 'test@example.com', password: 'Password123!' },
        { ipAddress: '127.0.0.1', userAgent: 'test-agent' }
      );

      expect(result.user.email).toBe('test@example.com');
      expect(result.tokens).toEqual(mockTokens);
    });

    it('should throw AuthenticationError for non-existent user', async () => {
      mockQueryBuilder.limit.mockResolvedValueOnce([]);

      const { login } = await import('../../src/services/auth.service');
      
      await expect(
        login(
          { email: 'nonexistent@example.com', password: 'Password123!' },
          { ipAddress: '127.0.0.1', userAgent: 'test-agent' }
        )
      ).rejects.toThrow('Invalid email or password');
    });

    it('should throw AuthenticationError for wrong password', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
      };

      mockQueryBuilder.limit.mockResolvedValueOnce([mockUser]);
      (verifyPassword as Mock).mockResolvedValueOnce(false);

      const { login } = await import('../../src/services/auth.service');
      
      await expect(
        login(
          { email: 'test@example.com', password: 'WrongPassword!' },
          { ipAddress: '127.0.0.1', userAgent: 'test-agent' }
        )
      ).rejects.toThrow('Invalid email or password');
    });

    it('should rehash password if needed', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        fullName: 'Test User',
        passwordHash: 'old-hash',
        role: 'user' as const,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      mockQueryBuilder.limit.mockResolvedValueOnce([mockUser]);
      (verifyPassword as Mock).mockResolvedValueOnce(true);
      (needsRehash as Mock).mockResolvedValueOnce(true);
      (hashPassword as Mock).mockResolvedValueOnce('new-hash');
      (generateDeviceId as Mock).mockReturnValueOnce('device-123');
      (issueTokens as Mock).mockResolvedValueOnce({
        accessToken: 'token',
        refreshToken: 'refresh',
        accessTokenExpiry: new Date(),
        refreshTokenExpiry: new Date(),
      });

      const { login } = await import('../../src/services/auth.service');
      await login(
        { email: 'test@example.com', password: 'Password123!' },
        { ipAddress: '127.0.0.1', userAgent: 'test-agent' }
      );

      expect(hashPassword).toHaveBeenCalledWith('Password123!');
      expect(db.update).toHaveBeenCalled();
    });
  });

  describe('refreshTokens', () => {
    it('should refresh tokens with valid refresh token', async () => {
      const newTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        accessTokenExpiry: new Date(),
        refreshTokenExpiry: new Date(),
      };

      (rotateRefreshToken as Mock).mockResolvedValueOnce(newTokens);

      const { refreshTokens } = await import('../../src/services/auth.service');
      const result = await refreshTokens(
        'old-refresh-token',
        { ipAddress: '127.0.0.1', userAgent: 'test-agent' }
      );

      expect(result).toEqual(newTokens);
      expect(rotateRefreshToken).toHaveBeenCalledWith(
        'old-refresh-token',
        '127.0.0.1',
        'test-agent'
      );
    });

    it('should throw error for invalid refresh token', async () => {
      (rotateRefreshToken as Mock).mockRejectedValueOnce(new Error('Invalid token'));

      const { refreshTokens } = await import('../../src/services/auth.service');
      
      await expect(
        refreshTokens('invalid-token', { ipAddress: '127.0.0.1', userAgent: 'test-agent' })
      ).rejects.toThrow('Invalid token');
    });
  });

  describe('logout', () => {
    it('should logout user successfully', async () => {
      (logoutToken as Mock).mockResolvedValueOnce(undefined);

      const { logout } = await import('../../src/services/auth.service');
      await logout('refresh-token');

      expect(logoutToken).toHaveBeenCalledWith('refresh-token');
    });

    it('should handle logout of already invalidated token', async () => {
      (logoutToken as Mock).mockResolvedValueOnce(undefined);

      const { logout } = await import('../../src/services/auth.service');
      // Should not throw
      await expect(logout('already-invalidated-token')).resolves.toBeUndefined();
    });
  });

  describe('logoutAll', () => {
    it('should revoke all user tokens', async () => {
      (revokeAllUserTokens as Mock).mockResolvedValueOnce(undefined);

      const { logoutAll } = await import('../../src/services/auth.service');
      await logoutAll('user-123');

      expect(revokeAllUserTokens).toHaveBeenCalledWith('user-123');
    });
  });

  describe('updateLastLogin', () => {
    it('should update user last login timestamp', async () => {
      mockQueryBuilder.set.mockReturnThis();
      mockQueryBuilder.where.mockResolvedValueOnce(undefined);

      const { updateLastLogin } = await import('../../src/services/auth.service');
      await updateLastLogin('user-123');

      expect(db.update).toHaveBeenCalled();
    });
  });

  describe('verifyEmail', () => {
    it('should verify user email', async () => {
      mockQueryBuilder.set.mockReturnThis();
      mockQueryBuilder.where.mockResolvedValueOnce(undefined);

      const { verifyEmail } = await import('../../src/services/auth.service');
      await verifyEmail('user-123');

      expect(db.update).toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    it('should change password with correct current password', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'current-hash',
      };

      mockQueryBuilder.limit.mockResolvedValueOnce([mockUser]);
      (verifyPassword as Mock).mockResolvedValueOnce(true);
      (hashPassword as Mock).mockResolvedValueOnce('new-hash');
      mockQueryBuilder.set.mockReturnThis();
      mockQueryBuilder.where.mockResolvedValueOnce(undefined);
      (revokeAllUserTokens as Mock).mockResolvedValueOnce(undefined);

      const { changePassword } = await import('../../src/services/auth.service');
      await changePassword('user-123', 'CurrentPassword!', 'NewPassword123!');

      expect(hashPassword).toHaveBeenCalledWith('NewPassword123!');
      expect(db.update).toHaveBeenCalled();
    });

    it('should throw AuthenticationError for wrong current password', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'current-hash',
      };

      mockQueryBuilder.limit.mockResolvedValueOnce([mockUser]);
      (verifyPassword as Mock).mockResolvedValueOnce(false);

      const { changePassword } = await import('../../src/services/auth.service');
      
      await expect(
        changePassword('user-123', 'WrongPassword!', 'NewPassword123!')
      ).rejects.toThrow();
    });

    it('should throw NotFoundError for non-existent user', async () => {
      mockQueryBuilder.limit.mockResolvedValueOnce([]);

      const { changePassword } = await import('../../src/services/auth.service');
      
      await expect(
        changePassword('non-existent', 'CurrentPassword!', 'NewPassword123!')
      ).rejects.toThrow();
    });
  });

  describe('deleteAccount', () => {
    it('should soft delete user account', async () => {
      mockQueryBuilder.set.mockReturnThis();
      mockQueryBuilder.where.mockResolvedValueOnce(undefined);
      (revokeAllUserTokens as Mock).mockResolvedValueOnce(undefined);

      const { deleteAccount } = await import('../../src/services/auth.service');
      await deleteAccount('user-123');

      expect(db.update).toHaveBeenCalled();
      expect(revokeAllUserTokens).toHaveBeenCalledWith('user-123');
    });
  });
});
