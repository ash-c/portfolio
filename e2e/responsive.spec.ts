import { expect, gotoRoute, pageHeading, routes, tabUntilFocused, test } from './fixtures';

test.describe('responsive layout and keyboard access', () => {
  for (const { path, heading } of routes) {
    test(`header links are visible and actionable on ${path}`, async ({ page }) => {
      await gotoRoute(page, path, heading);
      const header = page.getByRole('banner');
      for (const name of ['Home', 'Projects', 'GitHub', 'LinkedIn']) {
        const link = header.getByRole('link', { name, exact: true });
        await expect(link).toBeInViewport();
        await link.click({ trial: true });
      }
    });

    test(`${path} has no horizontal document overflow`, async ({ page }) => {
      await gotoRoute(page, path, heading);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test('keyboard users can reach and activate the main internal links', async ({ page }) => {
    const header = page.getByRole('banner');
    await gotoRoute(page, '/', 'Ash Crockett');

    const cta = page.getByRole('main').getByRole('link', { name: 'View my work' });
    await tabUntilFocused(page, cta);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL('/projects');
    await expect(pageHeading(page, 'Projects')).toBeVisible();

    const home = header.getByRole('link', { name: 'Home', exact: true });
    await tabUntilFocused(page, home);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL('/');
    await expect(pageHeading(page, 'Ash Crockett')).toBeVisible();

    const projects = header.getByRole('link', { name: 'Projects', exact: true });
    await tabUntilFocused(page, projects);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL('/projects');
    await expect(pageHeading(page, 'Projects')).toBeVisible();
  });
});
