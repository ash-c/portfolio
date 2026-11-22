import { expect, test as base, type Locator, type Page } from '@playwright/test';

export { expect };

export const routes = [
  { path: '/', heading: 'Ash Crockett' },
  { path: '/projects', heading: 'Projects' },
] as const;

const appOrigin = 'http://127.0.0.1:4173';

export const test = base.extend<{ pageErrors: Error[] }>({
  pageErrors: [
    async ({ page }, use) => {
      const errors: Error[] = [];
      page.on('pageerror', (error) => errors.push(error));
      await use(errors);
      expect(errors, 'uncaught page errors').toEqual([]);
    },
    { auto: true },
  ],
  context: async ({ context }, use) => {
    // Never load third-party pages or resources from tests.
    await context.route(
      (url) => url.origin !== appOrigin,
      (route) => route.abort('blockedbyclient'),
    );
    await use(context);
  },
});

export const pageHeading = (page: Page, name: string) =>
  page.getByRole('main').getByRole('heading', { level: 1, name, exact: true });

export const gotoRoute = async (page: Page, path: string, heading: string) => {
  await page.goto(path);
  await expect(pageHeading(page, heading)).toBeVisible();
};

export const tabUntilFocused = async (page: Page, target: Locator, maxPresses = 30) => {
  const key = test.info().project.name === 'webkit' ? 'Alt+Tab' : 'Tab';
  for (let i = 0; i < maxPresses; i += 1) {
    await page.keyboard.press(key);
    if (await target.evaluate((element) => element === document.activeElement)) {
      return;
    }
  }
  await expect(target).toBeFocused();
};

export const heroBackgroundUrl = (page: Page) =>
  page
    .getByRole('main')
    .locator('section')
    .filter({ has: page.getByRole('heading', { level: 1, name: 'Ash Crockett', exact: true }) })
    .evaluate((section) => {
      const match = /url\("?([^")]+)"?\)/.exec(getComputedStyle(section).backgroundImage);
      return match ? new URL(match[1], document.baseURI).href : null;
    });
