import { QueryClient } from '@tanstack/react-query';

/**
 * Query Client Configuration
 * Optimized settings for caching and performance
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale time: how long data is considered fresh
      staleTime: 1000 * 60 * 5, // 5 minutes

      // Cache time: how long inactive data stays in cache
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)

      // Retry configuration
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors (client errors)
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          return false;
        }
        // Retry up to 3 times for server errors
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

      // Refetch settings
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchOnMount: true,
    },
    mutations: {
      retry: 1,
      retryDelay: 1000,
    },
  },
});

/**
 * Query Key Factory
 * Centralized query key management for cache invalidation
 */
export const queryKeys = {
  // Auth
  auth: {
    all: ['auth'] as const,
    user: () => [...queryKeys.auth.all, 'user'] as const,
  },

  // PDFs
  pdfs: {
    all: ['pdfs'] as const,
    lists: () => [...queryKeys.pdfs.all, 'list'] as const,
    list: (filters: Record<string, any>) => [...queryKeys.pdfs.lists(), filters] as const,
    details: () => [...queryKeys.pdfs.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.pdfs.details(), id] as const,
    questions: (id: string) => [...queryKeys.pdfs.detail(id), 'questions'] as const,
  },

  // Quiz Sessions
  quizSessions: {
    all: ['quiz-sessions'] as const,
    lists: () => [...queryKeys.quizSessions.all, 'list'] as const,
    list: (filters: Record<string, any>) => [...queryKeys.quizSessions.lists(), filters] as const,
    details: () => [...queryKeys.quizSessions.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.quizSessions.details(), id] as const,
    questions: (id: string) => [...queryKeys.quizSessions.detail(id), 'questions'] as const,
  },

  // Analytics
  analytics: {
    all: ['analytics'] as const,
    dashboard: () => [...queryKeys.analytics.all, 'dashboard'] as const,
    trends: () => [...queryKeys.analytics.all, 'trends'] as const,
    weakAreas: () => [...queryKeys.analytics.all, 'weak-areas'] as const,
    patterns: () => [...queryKeys.analytics.all, 'patterns'] as const,
    streaks: () => [...queryKeys.analytics.all, 'streaks'] as const,
  },

  // Settings
  settings: {
    all: ['settings'] as const,
    profile: () => [...queryKeys.settings.all, 'profile'] as const,
    sessions: () => [...queryKeys.settings.all, 'sessions'] as const,
  },
};

/**
 * Invalidate all user-specific data
 * Call this on logout or user change
 */
export function invalidateUserData() {
  queryClient.removeQueries({ queryKey: queryKeys.pdfs.all });
  queryClient.removeQueries({ queryKey: queryKeys.quizSessions.all });
  queryClient.removeQueries({ queryKey: queryKeys.analytics.all });
  queryClient.removeQueries({ queryKey: queryKeys.settings.all });
}

/**
 * Prefetch common data
 * Call this after login
 */
export async function prefetchCommonData() {
  // These will run in parallel
  await Promise.allSettled([
    queryClient.prefetchQuery({
      queryKey: queryKeys.analytics.dashboard(),
      staleTime: 1000 * 60 * 5,
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.pdfs.lists(),
      staleTime: 1000 * 60 * 5,
    }),
  ]);
}
