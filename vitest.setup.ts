/**
 * Vitest Global Setup
 * This file runs before all tests
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

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
