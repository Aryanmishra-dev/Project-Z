import { test, expect } from '@playwright/test';

const TEST_EMAIL = `auth-${Date.now()}@example.com`;
const TEST_PASSWORD = 'Password123!';
const WRONG_PASSWORD = 'WrongPassword123!';

test.describe('Authentication Flow', () => {
  test.beforeAll(async ({ browser }) => {
    // Register a user once for login tests
    // We create a new context/page just for registration
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('http://localhost:5173/register');
    await page.fill('input[name="fullName"]', 'Auth User');
    await page.fill('input[name="email"]', TEST_EMAIL);
    await page.fill('input[name="password"]', TEST_PASSWORD);
    await page.fill('input[name="confirmPassword"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard|login/);

    await context.close();
  });

  test('should fail with invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_EMAIL);
    await page.fill('input[name="password"]', WRONG_PASSWORD);
    await page.click('button[type="submit"]');

    // Check for error message
    // Assuming error toast or alert appears
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByText(/invalid credentials|incorrect/i)).toBeVisible();
  });

  test('should login successfully', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_EMAIL);
    await page.fill('input[name="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByText('Auth User')).toBeVisible(); // Assuming name is shown
  });

  test('should logout successfully', async ({ page }) => {
    // First login
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_EMAIL);
    await page.fill('input[name="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');

    // Perform logout
    // Assuming logout is in user menu
    const userMenu = page.getByRole('button', { name: /user menu|account|profile/i });
    if (await userMenu.isVisible()) {
      await userMenu.click();
      await page.getByText(/logout|sign out/i).click();
    } else {
      // Fallback: maybe just logout button visible?
      await page.getByText(/logout|sign out/i).click();
    }

    await expect(page).toHaveURL('/login');
  });
});
