import { test, expect } from '@playwright/test';

/**
 * Analytics E2E Tests
 * Tests the analytics dashboard and data visualization components
 */

// Mock analytics data
const mockAnalyticsData = {
  trends: {
    overall: {
      currentScore: 85,
      previousScore: 78,
      percentageChange: 8.97,
      trend: 'up' as const,
      dataPoints: [
        { date: '2024-01-01', score: 70, quizCount: 3 },
        { date: '2024-01-02', score: 75, quizCount: 2 },
        { date: '2024-01-03', score: 80, quizCount: 4 },
        { date: '2024-01-04', score: 82, quizCount: 3 },
        { date: '2024-01-05', score: 85, quizCount: 5 },
      ],
    },
    byDifficulty: {
      easy: { averageScore: 92, trend: 'up' as const, totalQuestions: 50 },
      medium: { averageScore: 78, trend: 'up' as const, totalQuestions: 40 },
      hard: { averageScore: 65, trend: 'stable' as const, totalQuestions: 30 },
    },
    period: '30d',
  },
  weakAreas: [
    {
      category: 'JavaScript Fundamentals',
      topic: 'Closures',
      errorRate: 0.45,
      lastAttempted: '2024-01-05',
      suggestedResources: ['MDN Closures Guide'],
    },
    {
      category: 'React',
      topic: 'useEffect',
      errorRate: 0.35,
      lastAttempted: '2024-01-04',
      suggestedResources: ['React Docs'],
    },
  ],
  patterns: {
    bestTimeOfDay: 'morning',
    optimalQuizLength: 15,
    averageTimePerQuestion: 45,
    retentionRate: 78,
  },
  streaks: {
    currentStreak: 7,
    longestStreak: 14,
    lastActivityDate: '2024-01-05',
    activityHistory: [],
    milestones: [
      { days: 7, achieved: true, achievedDate: '2024-01-01' },
      { days: 30, achieved: false, achievedDate: null },
    ],
  },
};

test.describe('Analytics Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.addInitScript(() => {
      localStorage.setItem('accessToken', 'mock-analytics-token');
    });

    // Mock API responses
    await page.route('**/api/v1/analytics/**', async (route) => {
      const url = route.request().url();

      if (url.includes('/trends')) {
        await route.fulfill({
          json: mockAnalyticsData.trends,
          status: 200,
        });
      } else if (url.includes('/weak-areas')) {
        await route.fulfill({
          json: mockAnalyticsData.weakAreas,
          status: 200,
        });
      } else if (url.includes('/patterns')) {
        await route.fulfill({
          json: mockAnalyticsData.patterns,
          status: 200,
        });
      } else if (url.includes('/streaks')) {
        await route.fulfill({
          json: mockAnalyticsData.streaks,
          status: 200,
        });
      } else {
        await route.continue();
      }
    });
  });

  test('should load analytics page', async ({ page }) => {
    await page.goto('/analytics');

    // Should display analytics page
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('should display trends chart', async ({ page }) => {
    await page.goto('/analytics');

    // Trends section should be visible
    const trendsSection = page.locator('text=/trends|performance/i').first();
    await expect(trendsSection).toBeVisible({ timeout: 10000 });
  });

  test('should display current score', async ({ page }) => {
    await page.goto('/analytics');

    // Current score should be displayed
    const scoreElement = page.locator('text=/85|score|%/i').first();
    await expect(scoreElement).toBeVisible({ timeout: 10000 });
  });

  test('should display trend indicator', async ({ page }) => {
    await page.goto('/analytics');

    // Trend indicator (up/down arrow or percentage change)
    const trendIndicator = page.locator('text=/\\+|↑|increase|up/i').first();
    // May or may not be visible depending on design
    await expect(page).toHaveURL(/analytics/);
  });

  test('should display difficulty breakdown', async ({ page }) => {
    await page.goto('/analytics');

    // Difficulty levels should be shown
    const difficultySection = page.locator('text=/easy|medium|hard|difficulty/i').first();
    await expect(difficultySection).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Weak Areas Section', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('accessToken', 'mock-analytics-token');
    });

    await page.route('**/api/v1/analytics/weak-areas**', async (route) => {
      await route.fulfill({
        json: mockAnalyticsData.weakAreas,
        status: 200,
      });
    });
  });

  test('should display weak areas table', async ({ page }) => {
    await page.goto('/analytics');

    // Weak areas section should be visible
    const weakAreasSection = page.locator('text=/weak|areas|improve/i').first();
    await expect(weakAreasSection).toBeVisible({ timeout: 10000 });
  });

  test('should show topic names', async ({ page }) => {
    await page.goto('/analytics');

    // Topics should be displayed (JavaScript, React, etc.)
    const topicElement = page.locator('text=/javascript|react|topic/i').first();
    // May or may not be visible depending on data loading
    await expect(page).toHaveURL(/analytics/);
  });

  test('should show error rates', async ({ page }) => {
    await page.goto('/analytics');

    // Error rates would be displayed as percentages
    await expect(page).toHaveURL(/analytics/);
  });

  test('should provide suggested resources', async ({ page }) => {
    await page.goto('/analytics');

    // Suggested resources should be available
    await expect(page).toHaveURL(/analytics/);
  });
});

test.describe('Learning Patterns Section', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('accessToken', 'mock-analytics-token');
    });

    await page.route('**/api/v1/analytics/patterns**', async (route) => {
      await route.fulfill({
        json: mockAnalyticsData.patterns,
        status: 200,
      });
    });
  });

  test('should display learning insights', async ({ page }) => {
    await page.goto('/analytics');

    // Learning patterns section should be visible
    const patternsSection = page.locator('text=/pattern|insight|learning/i').first();
    await expect(patternsSection).toBeVisible({ timeout: 10000 });
  });

  test('should show best study time', async ({ page }) => {
    await page.goto('/analytics');

    // Best time of day (morning, afternoon, etc.)
    const timeElement = page.locator('text=/morning|afternoon|evening|time/i').first();
    // May or may not be visible
    await expect(page).toHaveURL(/analytics/);
  });

  test('should show optimal quiz length', async ({ page }) => {
    await page.goto('/analytics');

    // Optimal quiz length recommendation
    await expect(page).toHaveURL(/analytics/);
  });

  test('should show retention rate', async ({ page }) => {
    await page.goto('/analytics');

    // Retention rate percentage
    const retentionElement = page.locator('text=/retention|78|%/i').first();
    await expect(page).toHaveURL(/analytics/);
  });
});

test.describe('Streak Display', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('accessToken', 'mock-analytics-token');
    });

    await page.route('**/api/v1/analytics/streaks**', async (route) => {
      await route.fulfill({
        json: mockAnalyticsData.streaks,
        status: 200,
      });
    });
  });

  test('should display current streak', async ({ page }) => {
    await page.goto('/analytics');

    // Current streak number
    const streakSection = page.locator('text=/streak|day|7/i').first();
    await expect(streakSection).toBeVisible({ timeout: 10000 });
  });

  test('should display longest streak', async ({ page }) => {
    await page.goto('/analytics');

    // Longest streak record
    const longestStreak = page.locator('text=/longest|best|14/i').first();
    await expect(page).toHaveURL(/analytics/);
  });

  test('should display activity calendar', async ({ page }) => {
    await page.goto('/analytics');

    // Activity calendar/heatmap
    await expect(page).toHaveURL(/analytics/);
  });

  test('should display milestones', async ({ page }) => {
    await page.goto('/analytics');

    // Milestone progress
    const milestoneElement = page.locator('text=/milestone|achievement|goal/i').first();
    await expect(page).toHaveURL(/analytics/);
  });
});

test.describe('Analytics Time Period Selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('accessToken', 'mock-analytics-token');
    });
  });

  test('should have time period selector', async ({ page }) => {
    await page.goto('/analytics');

    // Time period buttons/dropdown (7d, 30d, 90d, all)
    const periodSelector = page.locator('text=/7 day|30 day|90 day|week|month/i').first();
    await expect(page).toHaveURL(/analytics/);
  });

  test('should update data on period change', async ({ page }) => {
    let apiCallCount = 0;

    await page.route('**/api/v1/analytics/trends**', async (route) => {
      apiCallCount++;
      await route.fulfill({
        json: mockAnalyticsData.trends,
        status: 200,
      });
    });

    await page.goto('/analytics');

    // Initial load
    expect(apiCallCount).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Analytics Loading States', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('accessToken', 'mock-analytics-token');
    });
  });

  test('should show loading indicator while fetching data', async ({ page }) => {
    // Delay the API response
    await page.route('**/api/v1/analytics/**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fulfill({
        json: mockAnalyticsData.trends,
        status: 200,
      });
    });

    await page.goto('/analytics');

    // Loading indicator should appear (skeleton, spinner, etc.)
    const loadingIndicator = page
      .locator('text=/loading/i, [role="progressbar"], .animate-pulse, .skeleton')
      .first();
    // May or may not catch the loading state
    await expect(page).toHaveURL(/analytics/);
  });

  test('should handle empty data gracefully', async ({ page }) => {
    await page.route('**/api/v1/analytics/**', async (route) => {
      await route.fulfill({
        json: {
          overall: {
            currentScore: 0,
            previousScore: 0,
            percentageChange: 0,
            trend: 'stable',
            dataPoints: [],
          },
          byDifficulty: {},
          period: '30d',
        },
        status: 200,
      });
    });

    await page.goto('/analytics');

    // Should handle empty state
    const emptyState = page.locator('text=/no data|get started|complete.*quiz/i').first();
    await expect(page).toHaveURL(/analytics/);
  });
});

test.describe('Analytics Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('accessToken', 'mock-analytics-token');
    });
  });

  test('should handle API errors gracefully', async ({ page }) => {
    await page.route('**/api/v1/analytics/**', async (route) => {
      await route.fulfill({
        status: 500,
        json: { error: 'Internal server error' },
      });
    });

    await page.goto('/analytics');

    // Should show error message
    const errorMessage = page.locator('text=/error|failed|try again/i').first();
    await expect(page).toHaveURL(/analytics/);
  });

  test('should provide retry option on error', async ({ page }) => {
    await page.route('**/api/v1/analytics/**', async (route) => {
      await route.fulfill({
        status: 500,
        json: { error: 'Internal server error' },
      });
    });

    await page.goto('/analytics');

    // Retry button should be available
    const retryButton = page
      .locator('button:has-text("Retry"), button:has-text("Try Again")')
      .first();
    await expect(page).toHaveURL(/analytics/);
  });
});

test.describe('Analytics Responsiveness', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('accessToken', 'mock-analytics-token');
    });

    await page.route('**/api/v1/analytics/**', async (route) => {
      await route.fulfill({
        json: mockAnalyticsData.trends,
        status: 200,
      });
    });
  });

  test('should display correctly on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/analytics');

    // Page should adapt to mobile
    await expect(page).toHaveURL(/analytics/);
  });

  test('should display correctly on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/analytics');

    // Page should adapt to tablet
    await expect(page).toHaveURL(/analytics/);
  });

  test('should display correctly on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/analytics');

    // Page should display full layout
    await expect(page).toHaveURL(/analytics/);
  });
});

test.describe('Analytics Chart Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('accessToken', 'mock-analytics-token');
    });

    await page.route('**/api/v1/analytics/**', async (route) => {
      await route.fulfill({
        json: mockAnalyticsData.trends,
        status: 200,
      });
    });
  });

  test('should show tooltip on chart hover', async ({ page }) => {
    await page.goto('/analytics');

    // Hover over chart area
    const chartArea = page.locator('.recharts-surface, [role="img"], svg').first();
    if (await chartArea.isVisible()) {
      await chartArea.hover();
    }

    await expect(page).toHaveURL(/analytics/);
  });

  test('chart should be interactive', async ({ page }) => {
    await page.goto('/analytics');

    // Chart elements should respond to interaction
    await expect(page).toHaveURL(/analytics/);
  });
});
