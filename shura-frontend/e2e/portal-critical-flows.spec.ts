import { expect, test } from '@playwright/test';

const authenticated = Boolean(process.env.E2E_STORAGE_STATE);

test.describe('authenticated client critical-flow smoke', () => {
  test.skip(!authenticated, 'Set E2E_STORAGE_STATE to an ignored Auth0 client storage-state file.');

  test('role routing and primary portal destinations remain available', async ({ page }) => {
    await page.goto('/portal/home');
    await expect(page).toHaveURL(/\/portal\/(home|onboarding)$/);
    if (page.url().endsWith('/onboarding')) test.skip(true, 'Seeded client must finish onboarding before portal-flow smoke.');
    for (const destination of ['sessions', 'therapist', 'profile', 'preferences']) {
      await page.goto(`/portal/${destination}`);
      await expect(page.locator('main')).toBeVisible();
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    }
  });

  test('legacy call endpoints do not accept unauthenticated browser requests', async ({ request }) => {
    const response = await request.post('/api/calls/join', { data: { sessionId: 1 } });
    expect(response.status()).toBe(401);
  });
});
