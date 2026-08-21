import { expect, type Locator, type Page } from '@playwright/test';

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const settledContent = (page: Page, path: string): Locator => {
  const main = page.locator('#portal-main');
  switch (path) {
    case '/portal/home':
      return main.getByText('Where Faith Meets Healing', { exact: true });
    case '/portal/sessions':
      return main.getByRole('tablist', { name: 'Session status' });
    case '/portal/therapist':
      return main.getByText('Your therapist', { exact: true })
        .or(main.getByRole('heading', { name: 'Let’s find the right therapist for you' }));
    case '/portal/profile':
      return main.getByRole('button', { name: 'Delete my account' });
    case '/portal/preferences':
      return main.getByRole('heading', { name: 'Preferences', exact: true });
    case '/portal/billing':
      return main.getByRole('heading', { name: 'Billing and receipts' })
        .or(main.getByRole('heading', { name: 'Billing is not available' }));
    default:
      throw new Error(`No settled portal assertion is defined for ${path}`);
  }
};

export const expectPortalPageReady = async (page: Page, path: string) => {
  await expect(page).toHaveURL(new RegExp(`${escapeRegExp(path)}/?$`));
  await expect(settledContent(page, path)).toBeVisible();
  const main = page.locator('#portal-main');
  await expect(main.getByRole('heading', { name: 'We couldn’t load this page' })).toHaveCount(0);
  await expect(main.getByRole('status', { name: 'Loading' })).toHaveCount(0);
};
