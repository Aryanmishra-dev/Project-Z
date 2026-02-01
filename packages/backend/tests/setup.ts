/**
 * Test setup and utilities for backend tests
 */
import { vi, beforeAll, afterAll } from 'vitest';

// Set up test environment variables
beforeAll(() => {
  // Database config
  vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/test_db');
  vi.stubEnv('DATABASE_POOL_MIN', '1');
  vi.stubEnv('DATABASE_POOL_MAX', '5');
  
  // Redis config
  vi.stubEnv('REDIS_HOST', 'localhost');
  vi.stubEnv('REDIS_PORT', '6379');
  vi.stubEnv('REDIS_PASSWORD', '');
  vi.stubEnv('REDIS_DB', '1');
  
  // JWT config
  vi.stubEnv('JWT_SECRET', 'test-secret-key-for-jwt-testing-minimum-32-characters-long');
  vi.stubEnv('JWT_ACCESS_EXPIRES', '15m');
  vi.stubEnv('JWT_REFRESH_EXPIRES', '7d');
  
  // App config
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('LOG_LEVEL', 'error');
});

afterAll(() => {
  vi.unstubAllEnvs();
});

/**
 * Create mock request object
 */
export function createMockRequest(overrides = {}): any {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    path: '/test',
    method: 'GET',
    ...overrides,
  };
}

/**
 * Create mock response object
 */
export function createMockResponse(): any {
  const res: any = {
    statusCode: 200,
    jsonData: null,
  };
  
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  
  res.json = vi.fn((data: any) => {
    res.jsonData = data;
    return res;
  });
  
  res.setHeader = vi.fn(() => res);
  res.on = vi.fn(() => res);
  
  return res;
}

/**
 * Create mock next function
 */
export function createMockNext(): any {
  return vi.fn();
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100
): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error('waitFor timeout');
}

/**
 * Generate random email for testing
 */
export function randomEmail(): string {
  const random = Math.random().toString(36).substring(7);
  return `test-${random}@example.com`;
}

/**
 * Generate valid test password
 */
export function validPassword(): string {
  return 'TestP@ssword123';
}
