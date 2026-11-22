import { expect, gotoRoute, pageHeading, test } from './fixtures';

test.describe('navigation', () => {
  test('home page shows its heading and main sections', async ({ page }) => {
    await gotoRoute(page, '/', 'Ash Crockett');
    const main = page.getByRole('main');
    for (const name of ['About me', 'Skills & expertise', 'Get in touch']) {
      await expect(main.getByRole('heading', { level: 2, name })).toBeVisible();
    }
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('contentinfo')).toBeVisible();
  });

  test('hero call to action opens the projects page', async ({ page }) => {
    await gotoRoute(page, '/', 'Ash Crockett');
    await page.getByRole('main').getByRole('link', { name: 'View my work' }).click();
    await expect(page).toHaveURL('/projects');
    await expect(pageHeading(page, 'Projects')).toBeVisible();
  });

  test('header links switch routes and browser history works', async ({ page }) => {
    const header = page.getByRole('banner');
    await gotoRoute(page, '/', 'Ash Crockett');

    await header.getByRole('link', { name: 'Projects', exact: true }).click();
    await expect(page).toHaveURL('/projects');
    await expect(pageHeading(page, 'Projects')).toBeVisible();

    await header.getByRole('link', { name: 'Home', exact: true }).click();
    await expect(page).toHaveURL('/');
    await expect(pageHeading(page, 'Ash Crockett')).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL('/projects');
    await expect(pageHeading(page, 'Projects')).toBeVisible();

    await page.goForward();
    await expect(page).toHaveURL('/');
    await expect(pageHeading(page, 'Ash Crockett')).toBeVisible();
  });

  test('direct /projects request and reload render project content', async ({ page }) => {
    const response = await page.goto('/projects');
    expect(response?.status()).toBe(200);
    await expect(pageHeading(page, 'Projects')).toBeVisible();
    await expect(page.getByRole('main').getByRole('heading', { level: 2 }).first()).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL('/projects');
    await expect(pageHeading(page, 'Projects')).toBeVisible();
    await expect(page.getByRole('main').getByRole('heading', { level: 2 }).first()).toBeVisible();
  });

  test('a project card opens its detail page, which survives a reload', async ({ page }) => {
    await gotoRoute(page, '/projects', 'Projects');
    const titleLink = page
      .getByRole('main')
      .getByRole('heading', { level: 2 })
      .getByRole('link')
      .and(page.locator('[href^="/projects/"]'))
      .first();
    const title = await titleLink.innerText();

    // Click over the card's cue text, not the title, to prove the stretched link covers the card.
    const cue = page.getByRole('main').getByText('Read more', { exact: true }).first();
    await expect(cue).toBeVisible();
    const box = (await cue.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page).toHaveURL(/\/projects\/[a-z0-9-]+$/);
    await expect(pageHeading(page, title)).toBeVisible();

    await page.reload();
    await expect(pageHeading(page, title)).toBeVisible();

    await page.getByRole('main').getByRole('link', { name: 'Back to projects' }).click();
    await expect(page).toHaveURL('/projects');
  });

  test('outbound links open safely in a new tab', async ({ page }) => {
    await gotoRoute(page, '/', 'Ash Crockett');
    const expected = [
      { region: page.getByRole('banner'), name: 'GitHub', href: 'https://github.com/ash-c' },
      {
        region: page.getByRole('banner'),
        name: 'LinkedIn',
        href: /^https:\/\/www\.linkedin\.com\/in\/ashcrockett\/?$/,
      },
      { region: page.getByRole('contentinfo'), name: 'GitHub', href: 'https://github.com/ash-c' },
      {
        region: page.getByRole('contentinfo'),
        name: 'LinkedIn',
        href: /^https:\/\/www\.linkedin\.com\/in\/ashcrockett\/?$/,
      },
      {
        region: page.getByRole('main'),
        name: 'Connect on LinkedIn',
        href: /^https:\/\/www\.linkedin\.com\/in\/ashcrockett\/?$/,
      },
    ];

    for (const { region, name, href } of expected) {
      const link = region.getByRole('link', { name, exact: true });
      await expect(link).toHaveAttribute('href', href);
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', /\bnoopener\b/);
      await expect(link).toHaveAttribute('rel', /\bnoreferrer\b/);
    }
  });
});
