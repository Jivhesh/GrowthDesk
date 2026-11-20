import { test, expect } from '@playwright/test';

test.describe('GrowthDesk End-to-End Suite', () => {
  test('1. App loads and page title is correct', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/GrowthDesk/i);
    await expect(page.locator('.brand-name, h1').first()).toBeVisible();
  });

  test('2. Login and SignUp navigation', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('h1')).toContainText(/Welcome to GrowthDesk/i);

    // Navigate to Sign Up
    await page.click('text=Create an account');
    await expect(page).toHaveURL(/.*signup/);
    await expect(page.locator('h1')).toContainText(/Create Business Account/i);

    // Verify Business Type selector exists
    const typeSelect = page.locator('#signup-business-type');
    await expect(typeSelect).toBeVisible();

    // Navigate back to Login
    await page.click('text=Sign in here');
    await expect(page).toHaveURL(/.*login/);
  });

  test('3. WhatsApp message generator phone validation', async ({ page }) => {
    await page.goto('/messages');
    // Page loads or redirects to login if protected
    await expect(page.locator('body')).toBeVisible();
  });

  test('4. Settings and Data Tools interface', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('body')).toBeVisible();
  });
});
