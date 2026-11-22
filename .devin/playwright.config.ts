import { existsSync } from 'node:fs';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const root = path.resolve(__dirname, '..');
const host = '127.0.0.1';
const port = 4173;
const baseURL = `http://${host}:${port}`;
const isCI = !!process.env.CI;

if (!existsSync(path.join(root, 'dist', 'index.html'))) {
  throw new Error('dist/index.html not found. Run `npm run build` (or `npm run e2e`) first.');
}

const desktopViewport = { width: 1280, height: 800 };
const visualSpec = /visual\.spec\.ts$/;

export default defineConfig({
  testDir: path.join(root, 'e2e'),
  outputDir: path.join(root, 'test-results'),
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{projectName}/{arg}{ext}',
  updateSnapshots: 'none',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 1 : undefined,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
    toHaveScreenshot: { animations: 'disabled', caret: 'hide', scale: 'css' },
  },
  reporter: [
    ['line'],
    ['html', { outputFolder: path.join(root, 'playwright-report'), open: 'never' }],
  ],
  use: {
    baseURL,
    locale: 'en-NZ',
    timezoneId: 'Pacific/Auckland',
    colorScheme: 'light',
    reducedMotion: 'reduce',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: desktopViewport },
    },
    {
      name: 'firefox',
      testIgnore: visualSpec,
      use: { ...devices['Desktop Firefox'], viewport: desktopViewport },
    },
    {
      name: 'webkit',
      testIgnore: visualSpec,
      use: { ...devices['Desktop Safari'], viewport: desktopViewport },
    },
    {
      // Chromium emulating a Pixel 7 viewport, touch and user agent; not real Android hardware.
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: {
    command: 'npm run serve:e2e',
    cwd: root,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 30_000,
    env: { NO_UPDATE_CHECK: '1' },
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
