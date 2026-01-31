/**
 * Vitest Global Setup
 * This file runs before all tests
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

// Global test setup
beforeAll(async () => {
  // Initialize test environment
  process.env.NODE_ENV = 'test';
});

// Global test teardown
afterAll(async () => {
  // Cleanup after all tests
});

// Reset mocks before each test
beforeEach(() => {
  // Reset any mocks or state
});

afterEach(() => {
  // Cleanup after each test
});

// Extend Vitest matchers if needed
// import { expect } from 'vitest';
// expect.extend({});
