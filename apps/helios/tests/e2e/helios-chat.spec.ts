/**
 * HELIOS Chat E2E Tests
 */

import { test, expect } from '@playwright/test';

test.describe('HELIOS Chat Interface', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/health');
  });

  test('should load chat interface', async ({ page }) => {
    await expect(page.locator('[data-testid="helios-chat"]')).toBeVisible();
    await expect(page.locator('[data-testid="language-selector"]')).toBeVisible();
  });

  test('should display greeting message', async ({ page }) => {
    const greeting = page.locator('[data-testid="helios-message"]').first();
    await expect(greeting).toBeVisible();
    await expect(greeting).toContainText('health assistant');
  });

  test('should send message and receive response', async ({ page }) => {
    const input = page.locator('[data-testid="chat-input"]');
    const sendButton = page.locator('[data-testid="send-button"]');

    await input.fill('I have a headache');
    await sendButton.click();

    // Wait for response
    await expect(page.locator('[data-testid="helios-message"]')).toHaveCount(3, { timeout: 30000 });
  });

  test('should change language to Spanish', async ({ page }) => {
    const langSelector = page.locator('[data-testid="language-selector"]');
    await langSelector.selectOption('es');

    // Start new session
    const greeting = page.locator('[data-testid="helios-message"]').first();
    await expect(greeting).toContainText('asistente de salud');
  });

  test('should display red flag alert for emergency symptoms', async ({ page }) => {
    const input = page.locator('[data-testid="chat-input"]');

    await input.fill('I have severe chest pain and my left arm is numb');
    await page.locator('[data-testid="send-button"]').click();

    // Should show red flag warning
    await expect(page.locator('[data-testid="red-flag-alert"]')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('[data-testid="red-flag-alert"]')).toContainText('911');
  });

  test('should show triage level after assessment', async ({ page }) => {
    // Complete basic history
    const input = page.locator('[data-testid="chat-input"]');

    await input.fill('I have had a mild headache for 2 days');
    await page.locator('[data-testid="send-button"]').click();
    await page.waitForTimeout(3000);

    await input.fill('It started gradually, pain is about 4 out of 10');
    await page.locator('[data-testid="send-button"]').click();
    await page.waitForTimeout(3000);

    await input.fill('Tylenol helps a bit');
    await page.locator('[data-testid="send-button"]').click();

    // Should eventually show triage badge
    await expect(page.locator('[data-testid="triage-badge"]')).toBeVisible({ timeout: 60000 });
  });
});

test.describe('HELIOS Accessibility', () => {
  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/health');

    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="language-selector"]')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="chat-input"]')).toBeFocused();

    await page.keyboard.type('test message');
    await page.keyboard.press('Enter');

    // Message should be sent
    await expect(page.locator('[data-testid="helios-message"]')).toHaveCount(3, { timeout: 30000 });
  });

  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('/health');

    const chat = page.locator('[data-testid="helios-chat"]');
    await expect(chat).toHaveAttribute('aria-label');

    const input = page.locator('[data-testid="chat-input"]');
    await expect(input).toHaveAttribute('aria-label');
  });
});
