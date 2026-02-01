import { test, expect, Page } from '@playwright/test';

/**
 * Test fixtures and helpers
 */
const TEST_USER = {
  email: 'e2e-test@example.com',
  password: 'Test123!@#',
  fullName: 'E2E Test User',
};

/**
 * Helper to login a user
 */
async function login(page: Page, email: string = TEST_USER.email, password: string = TEST_USER.password) {
  await page.goto('/login');
  await page.fill('input[name="email"], input[type="email"]', email);
  await page.fill('input[name="password"], input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard/, { timeout: 10000 });
}

/**
 * Helper to register a new user
 */
async function register(page: Page, userData = TEST_USER) {
  await page.goto('/register');
  await page.fill('input[name="fullName"]', userData.fullName);
  await page.fill('input[name="email"], input[type="email"]', userData.email);
  await page.fill('input[name="password"], input[type="password"]', userData.password);
  await page.fill('input[name="confirmPassword"]', userData.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard/, { timeout: 10000 });
}

// ============================================================
// AUTH FLOW TESTS
// ============================================================

test.describe('Authentication Flow', () => {
  test.describe.configure({ mode: 'serial' });

  test('should show login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('h1, h2').first()).toContainText(/sign in|login|log in/i);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('should show validation errors on empty submit', async ({ page }) => {
    await page.goto('/login');
    await page.click('button[type="submit"]');
    
    // Should show validation errors
    await expect(page.locator('text=/email is required|invalid email/i')).toBeVisible();
  });

  test('should navigate to register from login', async ({ page }) => {
    await page.goto('/login');
    await page.click('text=/sign up|register|create account/i');
    await expect(page).toHaveURL(/register/);
  });

  test('should show register page with all fields', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('input[name="fullName"]')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });

  test('should show password requirements', async ({ page }) => {
    await page.goto('/register');
    const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
    await passwordInput.fill('weak');
    await page.click('button[type="submit"]');
    
    // Should show password requirement errors
    await expect(page.locator('text=/8 characters|uppercase|lowercase|number|special/i')).toBeVisible();
  });

  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/login/);
  });

  test('should redirect unauthenticated users from protected routes', async ({ page }) => {
    await page.goto('/pdfs');
    await expect(page).toHaveURL(/login/);

    await page.goto('/analytics');
    await expect(page).toHaveURL(/login/);

    await page.goto('/settings');
    await expect(page).toHaveURL(/login/);
  });
});

// ============================================================
// NAVIGATION TESTS
// ============================================================

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication state
    await page.addInitScript(() => {
      localStorage.setItem('accessToken', 'mock-token');
      localStorage.setItem('refreshToken', 'mock-refresh-token');
    });
  });

  test('should show navigation links on dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Check for main navigation items
    await expect(page.locator('text=Dashboard')).toBeVisible();
    await expect(page.locator('text=PDFs')).toBeVisible();
    await expect(page.locator('text=Analytics')).toBeVisible();
  });

  test('should navigate between pages', async ({ page }) => {
    await page.goto('/dashboard');

    // Navigate to PDFs
    await page.click('text=PDFs');
    await expect(page).toHaveURL(/pdfs/);

    // Navigate to Analytics
    await page.click('text=Analytics');
    await expect(page).toHaveURL(/analytics/);

    // Navigate back to Dashboard
    await page.click('text=Dashboard');
    await expect(page).toHaveURL(/dashboard/);
  });
});

// ============================================================
// DASHBOARD TESTS
// ============================================================

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.addInitScript(() => {
      localStorage.setItem('accessToken', 'mock-token');
    });
  });

  test('should display stats cards', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Should show stats section
    await expect(page.locator('text=/PDFs|Documents/i').first()).toBeVisible();
    await expect(page.locator('text=/Quizzes/i').first()).toBeVisible();
  });

  test('should have quick action buttons', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Should have upload or create action
    const uploadButton = page.locator('text=/upload|add|new/i').first();
    await expect(uploadButton).toBeVisible();
  });
});

// ============================================================
// ANALYTICS TESTS
// ============================================================

test.describe('Analytics Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('accessToken', 'mock-token');
    });
  });

  test('should display analytics page', async ({ page }) => {
    await page.goto('/analytics');
    
    await expect(page.locator('h1')).toContainText(/Analytics/i);
  });

  test('should show stats cards', async ({ page }) => {
    await page.goto('/analytics');
    
    // Should have stats overview
    await expect(page.locator('text=/PDFs|Documents/i').first()).toBeVisible();
    await expect(page.locator('text=/Quizzes/i').first()).toBeVisible();
    await expect(page.locator('text=/Score|Average/i').first()).toBeVisible();
  });

  test('should show trends section', async ({ page }) => {
    await page.goto('/analytics');
    
    // Wait for trends section to load
    await expect(page.locator('text=/Trends|Performance/i').first()).toBeVisible();
  });

  test('should show streak section', async ({ page }) => {
    await page.goto('/analytics');
    
    // Check for streak/activity display
    await expect(page.locator('text=/Streak|Activity/i').first()).toBeVisible();
  });
});

// ============================================================
// SETTINGS TESTS
// ============================================================

test.describe('Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('accessToken', 'mock-token');
    });
  });

  test('should display settings page', async ({ page }) => {
    await page.goto('/settings');
    
    await expect(page.locator('h1')).toContainText(/Settings/i);
  });

  test('should show profile section', async ({ page }) => {
    await page.goto('/settings');
    
    await expect(page.locator('text=/Profile/i').first()).toBeVisible();
    await expect(page.locator('input[name="fullName"]')).toBeVisible();
  });

  test('should show password change section', async ({ page }) => {
    await page.goto('/settings');
    
    await expect(page.locator('text=/Password|Change Password/i').first()).toBeVisible();
  });

  test('should show sessions section', async ({ page }) => {
    await page.goto('/settings');
    
    await expect(page.locator('text=/Sessions|Active Sessions/i').first()).toBeVisible();
  });

  test('should show danger zone section', async ({ page }) => {
    await page.goto('/settings');
    
    await expect(page.locator('text=/Danger|Delete Account/i').first()).toBeVisible();
  });

  test('should require password for account deletion', async ({ page }) => {
    await page.goto('/settings');
    
    // Find delete button - should be disabled initially
    const deleteButton = page.locator('button:has-text("Delete")').filter({ hasText: /Delete.*Account/i });
    await expect(deleteButton).toBeDisabled();
  });
});

// ============================================================
// PDF UPLOAD FLOW TESTS
// ============================================================

test.describe('PDF Upload Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('accessToken', 'mock-token');
    });
  });

  test('should show PDFs page', async ({ page }) => {
    await page.goto('/pdfs');
    
    await expect(page.locator('h1')).toContainText(/PDF|Document/i);
  });

  test('should have upload button', async ({ page }) => {
    await page.goto('/pdfs');
    
    const uploadButton = page.locator('button:has-text("Upload"), button:has-text("Add")').first();
    await expect(uploadButton).toBeVisible();
  });

  test('should show upload modal when clicking upload', async ({ page }) => {
    await page.goto('/pdfs');
    
    const uploadButton = page.locator('button:has-text("Upload"), button:has-text("Add")').first();
    await uploadButton.click();
    
    // Should show upload area
    await expect(page.locator('text=/drag.*drop|choose file|select file/i')).toBeVisible();
  });

  test('should show empty state when no PDFs', async ({ page }) => {
    await page.goto('/pdfs');
    
    // Should show empty state or PDF list
    const content = await page.textContent('body');
    const hasContent = content?.includes('PDF') || content?.includes('Upload') || content?.includes('Document');
    expect(hasContent).toBeTruthy();
  });
});

// ============================================================
// ERROR HANDLING TESTS
// ============================================================

test.describe('Error Handling', () => {
  test('should show 404 page for unknown routes', async ({ page }) => {
    await page.goto('/this-page-does-not-exist');
    
    await expect(page.locator('text=/not found|404|page doesn.*exist/i')).toBeVisible();
  });

  test('should have link to go home from 404', async ({ page }) => {
    await page.goto('/unknown-route');
    
    const homeLink = page.locator('a:has-text("Home"), a:has-text("Dashboard"), button:has-text("Go Home")').first();
    await expect(homeLink).toBeVisible();
  });
});

// ============================================================
// RESPONSIVE DESIGN TESTS
// ============================================================

test.describe('Responsive Design', () => {
  test('should work on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/login');
    
    // Should still show login form
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should work on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/login');
    
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should have mobile navigation', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('accessToken', 'mock-token');
    });
    
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard');
    
    // Should have hamburger menu or navigation visible
    const hasNav = await page.locator('nav, [role="navigation"], button[aria-label*="menu"]').count();
    expect(hasNav).toBeGreaterThan(0);
  });
});

// ============================================================
// ACCESSIBILITY TESTS
// ============================================================

test.describe('Accessibility', () => {
  test('should have proper page title', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/.+/); // Should have some title
  });

  test('should have visible focus states', async ({ page }) => {
    await page.goto('/login');
    
    // Tab to first input
    await page.keyboard.press('Tab');
    
    // Check that something is focused
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });

  test('should have proper form labels', async ({ page }) => {
    await page.goto('/login');
    
    // Inputs should have associated labels or aria-label
    const emailInput = page.locator('input[type="email"]');
    const hasLabel = await emailInput.getAttribute('aria-label') || 
                     await page.locator(`label[for="${await emailInput.getAttribute('id')}"]`).count() > 0;
    expect(hasLabel).toBeTruthy();
  });

  test('should have proper button labels', async ({ page }) => {
    await page.goto('/login');
    
    const submitButton = page.locator('button[type="submit"]');
    const buttonText = await submitButton.textContent();
    expect(buttonText?.trim().length).toBeGreaterThan(0);
  });
});
