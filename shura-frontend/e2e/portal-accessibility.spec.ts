import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const authenticated = Boolean(process.env.E2E_STORAGE_STATE);
const portalPages = ['/portal/home', '/portal/sessions', '/portal/therapist', '/portal/profile', '/portal/preferences', '/portal/billing'];

test.describe('authenticated client portal accessibility', () => {
  // All tests use the same authenticated synthetic client and should not issue
  // concurrent profile/notification requests through the same session.
  test.describe.configure({ mode: 'serial' });
  test.skip(!authenticated, 'Set E2E_STORAGE_STATE to an ignored Auth0 client storage-state file.');

  for (const path of portalPages) {
    test(`@a11y ${path} has no WCAG A/AA axe violations`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/portal\//);
      await expect(page.locator('main')).toBeVisible();
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test('@a11y keyboard menus and dialog restore focus', async ({ page }) => {
    await page.goto('/portal/profile');
    await expect(page).toHaveURL(/\/portal\/profile$/);
    await expect(page.getByRole('button', { name: 'Delete my account' })).toBeVisible();
    const account = page.getByRole('button', { name: 'Account menu' });
    await account.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toBeHidden();
    await expect(account).toBeFocused();

    const deleteButton = page.getByRole('button', { name: 'Delete my account' });
    await deleteButton.click();
    await expect(page.getByRole('dialog', { name: 'Permanently delete account?' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(deleteButton).toBeFocused();
  });
});
