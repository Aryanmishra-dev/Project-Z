import { test, expect } from '@playwright/test';
import path from 'path';

const TEST_EMAIL = `test-${Date.now()}@example.com`;
const TEST_PASSWORD = 'Password123!';

test.describe('PDF Upload Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Register a new user
    await page.goto('/register');
    await page.fill('input[name="fullName"]', 'Test User');
    await page.fill('input[name="email"]', TEST_EMAIL);
    await page.fill('input[name="password"]', TEST_PASSWORD);
    await page.fill('input[name="confirmPassword"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');

    // Expect redirection to dashboard or login
    // If login is automatic, we are good. If not, we log in.
    // Assuming auto-login or redirect to login.
    await expect(page).toHaveURL(/\/dashboard|login/);
    if (page.url().includes('login')) {
      await page.fill('input[name="email"]', TEST_EMAIL);
      await page.fill('input[name="password"]', TEST_PASSWORD);
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL('/dashboard');
    }
  });

  test('should successfully upload a PDF', async ({ page }) => {
    await page.goto('/pdfs');

    // Click upload button to open modal
    await page
      .getByRole('button', { name: /upload pdf/i })
      .first()
      .click();

    // Upload file
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByText(/drop your pdf here|upload a pdf/i).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path.join(__dirname, 'fixtures', 'test-document.pdf'));

    // Wait for upload button and click it
    const uploadBtn = page.getByRole('button', { name: 'Upload PDF', exact: true });
    await expect(uploadBtn).toBeVisible();
    await uploadBtn.click();

    // Verification: Expect the file to appear in the list or a success message
    // The bug caused a crash here. If we see the success toast or the file in list, it's fixed.
    await expect(page.getByText('test-document.pdf')).toBeVisible({ timeout: 10000 });
  });
});
