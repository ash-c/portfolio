import AxeBuilder from '@axe-core/playwright';
import { expect, gotoRoute, routes, test } from './fixtures';

const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const auditedRoutes = [...routes, { path: '/projects/access-aps-nz', heading: 'Access APS NZ' }];

test.describe('accessibility (axe, WCAG 2.2 A/AA)', () => {
  for (const { path, heading } of auditedRoutes) {
    test(`${path} has no detectable violations`, async ({ page }, testInfo) => {
      await gotoRoute(page, path, heading);

      const results = await new AxeBuilder({ page }).withTags(wcagTags).analyze();

      if (results.violations.length > 0) {
        await testInfo.attach('axe-violations.json', {
          body: JSON.stringify(results.violations, null, 2),
          contentType: 'application/json',
        });
      }
      const summary = results.violations.map(({ id, impact, help, nodes }) => ({
        id,
        impact,
        help,
        targets: nodes.map((node) => node.target.join(' ')),
      }));
      expect(summary).toEqual([]);
    });
  }
});
