import { test, expect } from '@playwright/test';
import path from 'path';

const TEST_EMAIL = `flow-${Date.now()}@example.com`;
const TEST_PASSWORD = 'Password123!';

test.describe('Core Feature Flow', () => {
  test('should complete full user journey', async ({ page }) => {
    // 1. Register
    await page.goto('/register');
    await page.fill('input[name="fullName"]', 'Flow User');
    await page.fill('input[name="email"]', TEST_EMAIL);
    await page.fill('input[name="password"]', TEST_PASSWORD);
    await page.fill('input[name="confirmPassword"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard|login/);
    if (page.url().includes('login')) {
      await page.fill('input[name="email"]', TEST_EMAIL);
      await page.fill('input[name="password"]', TEST_PASSWORD);
      await page.click('button[type="submit"]');
    }
    await expect(page).toHaveURL('/dashboard');

    // 2. Navigate to PDFs and Upload
    await page.click('a[href="/pdfs"]'); // Assuming nav link
    await page.getByRole('button', { name: 'Upload PDF', exact: true }).first().click();

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByText(/drop your pdf here|upload a pdf/i).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path.join(__dirname, 'fixtures', 'test-document.pdf'));

    await page.getByRole('button', { name: 'Upload PDF', exact: true }).click();

    // 3. Verify Upload and Wait for Processing
    // Expect the file card to appear
    const pdfCard = page.getByText('test-document.pdf').first();
    await expect(pdfCard).toBeVisible();

    // 4. Click to view details
    // We need to click the card or a "View" button.
    // Assuming the whole card is clickable or has a link.
    // Let's find the link within the card.
    // The card usually has a link wrapper.
    // Or we wait for processing status.

    // Check if status says "Processing" or "Completed"
    // We can poll for text "Completed"
    await expect
      .poll(
        async () => {
          const text = await page.getByText(/completed|generating|processing/i).allInnerTexts();
          return text.join(' ').toLowerCase();
        },
        { timeout: 30000 }
      )
      .toMatch(/completed/);

    // Click the PDF card (or title) to view details
    await page.getByText('test-document.pdf').first().click();

    // 5. Verify Details Page
    // Should see "Questions" or "Quiz" button
    await expect(page).toHaveURL(/\/pdfs\//);
    await expect(page.getByText(/questions generated/i)).toBeVisible({ timeout: 10000 });
  });
});
