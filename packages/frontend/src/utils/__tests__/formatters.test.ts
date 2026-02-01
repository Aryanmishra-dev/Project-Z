import { describe, it, expect } from 'vitest';
import {
  formatRelativeTime,
  formatDate,
  formatDateTime,
  formatPercentage,
  formatScore,
  formatFileSize,
  formatDuration,
  formatTimer,
  formatCount,
  truncateText,
} from '../formatters';

describe('formatRelativeTime', () => {
  it('returns "just now" for recent dates', () => {
    const now = new Date();
    const result = formatRelativeTime(now);
    expect(result).toMatch(/just now|less than|seconds ago/i);
  });

  it('handles string dates', () => {
    const date = new Date(Date.now() - 60000).toISOString(); // 1 minute ago
    const result = formatRelativeTime(date);
    expect(result).toMatch(/minute|ago/i);
  });

  it('handles invalid dates', () => {
    expect(formatRelativeTime('invalid')).toBe('Invalid date');
  });
});

describe('formatDate', () => {
  it('formats date with default format', () => {
    const result = formatDate('2024-01-15T12:00:00.000Z');
    expect(result).toMatch(/Jan.*15.*2024|15.*Jan.*2024/);
  });

  it('uses custom format', () => {
    const result = formatDate('2024-01-15', 'yyyy-MM-dd');
    expect(result).toBe('2024-01-15');
  });

  it('handles invalid dates', () => {
    expect(formatDate('invalid')).toBe('Invalid date');
  });
});

describe('formatDateTime', () => {
  it('formats date with time', () => {
    const result = formatDateTime('2024-01-15T14:30:00.000Z');
    expect(result).toMatch(/Jan.*15.*2024.*2:30|Jan.*15.*2024.*PM/i);
  });

  it('handles invalid dates', () => {
    expect(formatDateTime('invalid')).toBe('Invalid date');
  });
});

describe('formatPercentage', () => {
  it('converts decimal to percentage', () => {
    expect(formatPercentage(0.75)).toBe('75%');
  });

  it('handles decimals', () => {
    expect(formatPercentage(0.756, 1)).toBe('75.6%');
    expect(formatPercentage(0.756, 2)).toBe('75.60%');
  });

  it('handles edge cases', () => {
    expect(formatPercentage(0)).toBe('0%');
    expect(formatPercentage(1)).toBe('100%');
  });
});

describe('formatScore', () => {
  it('formats score as percentage', () => {
    expect(formatScore(75)).toBe('75%');
    expect(formatScore(100)).toBe('100%');
  });

  it('rounds to nearest integer', () => {
    expect(formatScore(75.7)).toBe('76%');
    expect(formatScore(75.4)).toBe('75%');
  });
});

describe('formatFileSize', () => {
  it('formats bytes', () => {
    expect(formatFileSize(500)).toBe('500 Bytes');
  });

  it('formats kilobytes', () => {
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
  });

  it('formats megabytes', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1 MB');
    expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
  });

  it('formats gigabytes', () => {
    expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
  });

  it('handles zero', () => {
    expect(formatFileSize(0)).toBe('0 Bytes');
  });
});

describe('formatDuration', () => {
  it('formats seconds', () => {
    expect(formatDuration(45)).toBe('45s');
  });

  it('formats minutes', () => {
    expect(formatDuration(60)).toBe('1m');
    expect(formatDuration(90)).toBe('1m 30s');
  });

  it('formats hours', () => {
    expect(formatDuration(3600)).toBe('1h 0m');
    expect(formatDuration(3660)).toBe('1h 1m');
  });
});

describe('formatTimer', () => {
  it('formats as MM:SS', () => {
    expect(formatTimer(0)).toBe('00:00');
    expect(formatTimer(59)).toBe('00:59');
    expect(formatTimer(60)).toBe('01:00');
    expect(formatTimer(125)).toBe('02:05');
  });

  it('handles long durations', () => {
    expect(formatTimer(3661)).toBe('61:01');
  });
});

describe('formatCount', () => {
  it('uses singular for 1', () => {
    expect(formatCount(1, 'item')).toBe('1 item');
    expect(formatCount(1, 'page')).toBe('1 page');
  });

  it('uses plural for 0 and > 1', () => {
    expect(formatCount(0, 'item')).toBe('0 items');
    expect(formatCount(5, 'item')).toBe('5 items');
  });

  it('uses custom plural form', () => {
    expect(formatCount(2, 'quiz', 'quizzes')).toBe('2 quizzes');
    expect(formatCount(1, 'quiz', 'quizzes')).toBe('1 quiz');
  });
});

describe('truncateText', () => {
  it('returns text if shorter than max length', () => {
    expect(truncateText('Hello', 10)).toBe('Hello');
  });

  it('truncates with ellipsis', () => {
    expect(truncateText('Hello World', 8)).toBe('Hello...');
  });

  it('handles exact length', () => {
    expect(truncateText('Hello', 5)).toBe('Hello');
  });

  it('handles very short max length', () => {
    expect(truncateText('Hello World', 5)).toBe('He...');
  });
});
