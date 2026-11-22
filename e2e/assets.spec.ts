import type { Response } from '@playwright/test';
import { expect, gotoRoute, heroBackgroundUrl, routes, test } from './fixtures';

const isScript = (response: Response) => response.request().resourceType() === 'script';

test.describe('production assets', () => {
  for (const { path, heading } of routes) {
    test(`JavaScript for ${path} is served as JavaScript`, async ({ page }) => {
      const scripts: Response[] = [];
      page.on('response', (response) => {
        if (isScript(response)) scripts.push(response);
      });

      await gotoRoute(page, path, heading);

      expect(scripts.length).toBeGreaterThan(0);
      for (const response of scripts) {
        expect(response.status(), response.url()).toBe(200);
        expect(response.headers()['content-type'], response.url()).toMatch(
          /^(application|text)\/javascript\b/,
        );
      }
    });
  }

  test('hero background image loads as a JPEG', async ({ page }) => {
    const jpeg = page.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith('.jpg'),
    );
    await gotoRoute(page, '/', 'Ash Crockett');

    const backgroundUrl = await heroBackgroundUrl(page);
    expect(backgroundUrl).toMatch(/\.jpg$/);

    const response = await jpeg;
    expect(response.url()).toBe(backgroundUrl);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toBe('image/jpeg');

    const size = await page.evaluate(async (url) => {
      const image = new Image();
      image.src = url;
      await image.decode();
      return { width: image.naturalWidth, height: image.naturalHeight };
    }, backgroundUrl!);
    expect(size.width).toBeGreaterThan(0);
    expect(size.height).toBeGreaterThan(0);
  });
});
