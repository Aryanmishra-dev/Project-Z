/**
 * API Configuration
 */
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
export const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000';

/**
 * PDF Upload Configuration
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const ACCEPTED_FILE_TYPES = {
  'application/pdf': ['.pdf'],
};

/**
 * Quiz Configuration
 */
export const MIN_QUESTIONS = 1;
export const MAX_QUESTIONS = 50;
export const DEFAULT_QUESTION_COUNT = 10;

/**
 * Pagination
 */
export const DEFAULT_PAGE_SIZE = 12;
export const PAGE_SIZE_OPTIONS = [12, 24, 48];

/**
 * Cache Configuration
 */
export const CACHE_TIME = 5 * 60 * 1000; // 5 minutes
export const STALE_TIME = 2 * 60 * 1000; // 2 minutes

/**
 * Status Colors
 */
export const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
} as const;

/**
 * Difficulty Labels and Colors
 */
export const DIFFICULTY_CONFIG = {
  easy: {
    label: 'Easy',
    color: 'bg-green-100 text-green-800',
    badgeColor: 'bg-green-500',
  },
  medium: {
    label: 'Medium',
    color: 'bg-yellow-100 text-yellow-800',
    badgeColor: 'bg-yellow-500',
  },
  hard: {
    label: 'Hard',
    color: 'bg-red-100 text-red-800',
    badgeColor: 'bg-red-500',
  },
} as const;

/**
 * Performance Badges
 */
export const PERFORMANCE_BADGES = {
  excellent: {
    label: 'Excellent',
    minScore: 90,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
  },
  good: {
    label: 'Good',
    minScore: 70,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  needsImprovement: {
    label: 'Needs Improvement',
    minScore: 0,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
  },
} as const;

/**
 * Get performance badge based on score
 */
export function getPerformanceBadge(score: number) {
  if (score >= PERFORMANCE_BADGES.excellent.minScore) {
    return PERFORMANCE_BADGES.excellent;
  }
  if (score >= PERFORMANCE_BADGES.good.minScore) {
    return PERFORMANCE_BADGES.good;
  }
  return PERFORMANCE_BADGES.needsImprovement;
}

/**
 * Processing Steps
 */
export const PROCESSING_STEPS = [
  { id: 'extracting', label: 'Extracting Text', icon: '📄' },
  { id: 'chunking', label: 'Processing Content', icon: '🔄' },
  { id: 'generating', label: 'Generating Questions', icon: '🧠' },
  { id: 'validating', label: 'Validating Quality', icon: '✅' },
  { id: 'completed', label: 'Completed', icon: '🎉' },
] as const;

/**
 * Routes
 */
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',
  PDFS: '/pdfs',
  PDF_DETAIL: (id: string) => `/pdfs/${id}`,
  QUIZ: (sessionId: string) => `/quiz/${sessionId}`,
  QUIZ_RESULTS: (sessionId: string) => `/quiz/${sessionId}/results`,
  ANALYTICS: '/analytics',
  SETTINGS: '/settings',
} as const;
