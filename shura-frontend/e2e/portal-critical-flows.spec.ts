import { expect, test } from '@playwright/test';
import { expectPortalPageReady } from './portalTestHelpers';

const authenticated = Boolean(process.env.E2E_STORAGE_STATE);

test.describe('authenticated client critical-flow smoke', () => {
  test.skip(!authenticated, 'Set E2E_STORAGE_STATE to an ignored Auth0 client storage-state file.');

  test('client routing and primary portal destinations reach settled content', async ({ page }) => {
    await page.goto('/portal/home');
    await expect(page).toHaveURL(/\/portal\/(home|onboarding)$/);
    if (page.url().endsWith('/onboarding')) test.skip(true, 'Seeded client must finish onboarding before portal-flow smoke.');
    await expectPortalPageReady(page, '/portal/home');
    for (const destination of ['sessions', 'therapist', 'profile', 'preferences']) {
      const path = `/portal/${destination}`;
      await page.goto(path);
      await expectPortalPageReady(page, path);
    }
  });

  test('legacy call endpoints do not accept unauthenticated browser requests', async ({ request }) => {
    const response = await request.post('/api/calls/join', { data: { sessionId: 1 } });
    expect(response.status()).toBe(401);
  });
});
