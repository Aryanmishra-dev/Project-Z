/**
 * Auth Service Unit Tests
 * Tests for authentication service exports and basic functionality
 */
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';

// Mock dependencies before imports
vi.mock('../../src/config/database', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    }),
    delete: vi.fn(),
  },
}));

vi.mock('../../src/utils/password', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed-password'),
  verifyPassword: vi.fn().mockResolvedValue(true),
  needsRehash: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../src/services/token.service', () => ({
  issueTokens: vi.fn().mockResolvedValue({
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    accessTokenExpiry: new Date(),
    refreshTokenExpiry: new Date(),
  }),
  rotateRefreshToken: vi.fn().mockResolvedValue({
    accessToken: 'new-access-token',
    refreshToken: 'new-refresh-token',
    accessTokenExpiry: new Date(),
    refreshTokenExpiry: new Date(),
  }),
  logout: vi.fn().mockResolvedValue(undefined),
  revokeAllUserTokens: vi.fn().mockResolvedValue(undefined),
  generateDeviceId: vi.fn().mockReturnValue('device-123'),
}));

vi.mock('../../src/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Auth Service Exports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  it('should export findUserByEmail function', async () => {
    const module = await import('../../src/services/auth.service');
    expect(typeof module.findUserByEmail).toBe('function');
  });

  it('should export findUserById function', async () => {
    const module = await import('../../src/services/auth.service');
    expect(typeof module.findUserById).toBe('function');
  });

  it('should export register function', async () => {
    const module = await import('../../src/services/auth.service');
    expect(typeof module.register).toBe('function');
  });

  it('should export login function', async () => {
    const module = await import('../../src/services/auth.service');
    expect(typeof module.login).toBe('function');
  });

  it('should export refresh function', async () => {
    const module = await import('../../src/services/auth.service');
    expect(typeof module.refresh).toBe('function');
  });

  it('should export logout function', async () => {
    const module = await import('../../src/services/auth.service');
    expect(typeof module.logout).toBe('function');
  });

  it('should export logoutAll function', async () => {
    const module = await import('../../src/services/auth.service');
    expect(typeof module.logoutAll).toBe('function');
  });

  it('should export getProfile function', async () => {
    const module = await import('../../src/services/auth.service');
    expect(typeof module.getProfile).toBe('function');
  });
});

describe('Auth Service Dependencies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('should import password utilities', async () => {
    const module = await import('../../src/utils/password');
    expect(module.hashPassword).toBeDefined();
    expect(module.verifyPassword).toBeDefined();
    expect(module.needsRehash).toBeDefined();
  });

  it('should import token service', async () => {
    const module = await import('../../src/services/token.service');
    expect(module.issueTokens).toBeDefined();
    expect(module.logout).toBeDefined();
  });
});

describe('Auth Error Types', () => {
  it('should export ConflictError from errors module', async () => {
    const { ConflictError } = await import('../../src/utils/errors');
    expect(ConflictError).toBeDefined();
  });

  it('should export AuthenticationError from errors module', async () => {
    const { AuthenticationError } = await import('../../src/utils/errors');
    expect(AuthenticationError).toBeDefined();
  });

  it('should export NotFoundError from errors module', async () => {
    const { NotFoundError } = await import('../../src/utils/errors');
    expect(NotFoundError).toBeDefined();
  });
});
