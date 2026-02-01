/**
 * Utility functions shared across packages
 */

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Sleep utility for async operations
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate random ID (UUID v4 compatible)
 */
export function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Sanitize filename
 */
export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-z0-9.-]/gi, '_').toLowerCase();
}

/**
 * Calculate quality score based on question attributes
 */
export function calculateQualityScore(question: {
  questionText: string;
  correctAnswer: string;
  options?: string[];
}): number {
  let score = 0.5; // Base score

  // Check question length
  if (question.questionText.length >= 20 && question.questionText.length <= 200) {
    score += 0.2;
  }

  // Check if question ends with question mark
  if (question.questionText.trim().endsWith('?')) {
    score += 0.1;
  }

  // Check correct answer length
  if (question.correctAnswer.length >= 2) {
    score += 0.1;
  }

  // Check options quality (for multiple choice)
  if (question.options && question.options.length >= 3) {
    score += 0.1;
  }

  return Math.min(score, 1.0);
}
