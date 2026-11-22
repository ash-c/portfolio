import { expect, gotoRoute, heroBackgroundUrl, test } from './fixtures';

// Baselines are generated and compared only on the Linux CI image; fonts and rendering differ elsewhere.
test.skip(process.platform !== 'linux', 'Visual baselines are Linux-only');

test.describe('visual regression', () => {
  test.beforeEach(async ({ page }) => {
    // Freeze the clock so the footer copyright year is stable.
    await page.clock.setFixedTime(new Date('2026-06-01T12:00:00+12:00'));
  });

  test('home page', async ({ page }) => {
    await gotoRoute(page, '/', 'Ash Crockett');
    const backgroundUrl = await heroBackgroundUrl(page);
    await page.evaluate(async (url) => {
      const image = new Image();
      image.src = url;
      await image.decode();
      await document.fonts.ready;
    }, backgroundUrl!);
    await expect(page).toHaveScreenshot('home.png', { fullPage: true });
  });

  test('projects page', async ({ page }) => {
    await gotoRoute(page, '/projects', 'Projects');
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    await expect(page).toHaveScreenshot('projects.png', { fullPage: true });
  });
});
