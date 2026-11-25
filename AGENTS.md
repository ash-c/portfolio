# cw-website

Ash Crockett's portfolio: a React 19 + TypeScript SPA styled with Chakra UI 3 (Emotion), routed with react-router-dom 7, bundled by webpack 5, deployed to Netlify.

## Commands

- `npm run start`: dev server on http://localhost:3000. `npm run build`: production bundle in `dist/`.
- `npm run lint` / `lint:fix` (ESLint 9 flat config), `npm run format` / `format:check` (Prettier), `npm run typecheck`, `npm test`.
- Use npm (`package-lock.json`); don't add another lockfile.

## Conventions

- Components are named arrow-function exports (`export const NavBar = () => ...`); ESLint forbids default exports.
- Style with Chakra primitives, style props, and tokens in `src/theme.ts`. Don't add CSS files; the webpack CSS rule is unused.
- Import images as modules; add a type in `src/assets.d.ts` for any new extension (only `*.svg` and `*.jpg` exist).
- Pages live in `src/pages/` and are lazy-loaded in `src/App.tsx`. Shared components go in `src/components/`; page-specific sections in `src/components/<page>/` (e.g. `home/`).
- Netlify reads `netlify.toml`: `npm run build`, publish `dist`, Node 24, and a `/* -> /index.html` SPA redirect.

## Decisions

Read the relevant records in `docs/adr/` before changing tooling or structure. Add a new ADR in `docs/adr/` (copy the sibling Home Repo template `../home-repo/docs/adr/0000-template.md`) for any significant decision, and mark ones it replaces as Superseded.

## Project checks and UI tests

Use Node 24 and npm with the checked-in lockfile. Node 24.13.1 with npm 11.8.0 is a verified local pairing; CI and Netlify use Node 24.

```sh
npm ci
npm run check
```

`check` runs `npm run lint`, `npm run format:check`, `npm run typecheck` (app and test programs), `npm run test:coverage`, and `npm run build` in that order. `npm test` runs tests once without coverage. `npm run test:watch` reruns affected tests during edits.

## Add a test

- Put the test beside its source: `NavBar.tsx` → `NavBar.test.tsx`, or use `*.test.ts` when no JSX is needed. Import Vitest APIs explicitly.
- Render a component with `renderWithProviders` from `src/testing/render.tsx`. It supplies the real Chakra system, a MemoryRouter, and a fresh user-event instance. For `App`, call Testing Library's `render` directly: App owns its own Chakra provider and BrowserRouter.
- Assert what users can observe. Prefer role and accessible name, then label, then visible text. Use a test ID only when there is no suitable user-facing query, and explain why.
- Await user-event interactions. Use `findBy` or `waitFor` only when the behavior is asynchronous. Don't use arbitrary delays, blanket snapshots, provider/router/component mocks, CSS assertions, live network calls, or external navigation.
- Run the new file with npm argument forwarding: `npm test -- src/components/NavBar.test.tsx`.

## Coverage and reuse

Each production TypeScript file under `src/` must reach 80% statements, branches, functions, and lines, even if no test imports it. Only the browser bootstrap (`src/index.tsx`), type declarations (`src/**/*.d.ts`), colocated tests (`src/**/*.test.{ts,tsx}`), and test infrastructure (`src/testing/**`) are excluded because they are not production UI or supporting logic under test. Cover the theme, icons, and project data through the real UI. Never lower a threshold or exclude production code to make a check pass.

Run `npm run test:coverage` for the whole gate and open `coverage/index.html` for file-level details. The runner config in `.devin/`, DOM setup, and test conventions can be copied. Adapt the Chakra system and router wrapper for the destination project; no shared package is needed.

## Browser tests (Playwright)

Playwright tests in `e2e/` run against the production build in `dist/`, served as an SPA by `npm run serve:e2e` (`serve` on 127.0.0.1:4173 only). The config is `.devin/playwright.config.ts`. It starts that server itself and fails if something already listens on 4173: stop the other process instead of reusing it.

- One-time browser setup: `npx playwright install --with-deps chromium firefox webkit` (`--with-deps` installs OS packages and needs sudo).
- `npm run e2e` builds and then runs everything. If `dist/` is current, `npm run test:e2e` skips the build. A missing `dist/index.html` fails fast.
- Single project or spec: `npm run test:e2e -- --project=firefox e2e/navigation.spec.ts`. Add `-g "<title>"` to pick one test.
- Debug: `npm run test:e2e:ui` (UI mode) or `npm run test:e2e:debug` (inspector). `npm run test:e2e:report` opens the last HTML report from `playwright-report/`. Traces, failure screenshots, axe JSON and screenshot diffs go to `test-results/`. Both folders are git-ignored.
- Projects: `chromium`, `firefox` and `webkit` use a fixed 1280×800 viewport. `mobile-chromium` is Chromium emulating a Pixel 7, not real Android or iOS hardware. All four run the functional and accessibility specs. Only the two Chromium projects run `visual.spec.ts`.
- Tests use the shared `test` from `e2e/fixtures.ts`. It fails a test on any uncaught page error and blocks every non-local request, so no test loads LinkedIn, GitHub or other third-party pages. Check outbound links by `href`, `target` and `rel`; never click them.
- Follow the unit-test locator rules: role and accessible name scoped to `banner`, `main` or `contentinfo`, web-first assertions, and no sleeps, forced clicks, CSS classes or test IDs.
- CI (`.github/workflows/ci.yml`): `e2e-build` builds `dist/` once. The `e2e` matrix runs one job per project with one worker and at most one retry, and uploads `playwright-<project>` diagnostics (report and test results) for 7 days. `test.only` fails CI.

### Accessibility failures

`e2e/accessibility.spec.ts` runs axe with WCAG 2.0/2.1/2.2 A and AA tags on every route. It requires zero violations and attaches `axe-violations.json` when a scan fails. Fix the component; never disable rules, exclude selectors or filter by impact. Axe can't prove keyboard usability, so keep the keyboard tests in `responsive.spec.ts`. The project cards use a stretched title link (the `::after` overlay in `ProjectsPage.tsx`) so each card's accessible name matches its visible link text. Don't wrap a whole card in a link.

### Visual baselines

Baselines live in `e2e/__screenshots__/<spec>/<project>/` and are compared only on Linux. `visual.spec.ts` skips on other platforms, and screenshots from other hosts or other Linux setups aren't interchangeable. The CI runner (`ubuntu-latest` with Playwright's `--with-deps` packages) is the only authoritative environment. Comparisons never update snapshots, and a missing or mismatched baseline fails the test.

To change baselines after an intentional UI change:

1. Run the **CI** workflow manually (Actions → CI → Run workflow) on your branch with **candidate_baselines** checked. Its `e2e-candidate-baselines` jobs upload `candidate-baselines-<project>` artifacts. They never commit anything and need no write permission. Workflow dispatch only works once the workflow is on `main`. For a changed screenshot, a failing PR run's `playwright-<project>` artifact also has `*-actual.png` and `*-diff.png`. For a new screenshot it has neither, because Playwright skips rendering when the baseline is missing and updates are off.
2. Review the expected, actual and diff images in the HTML report. Copy only the approved PNGs into `e2e/__screenshots__/` and commit them.
3. Push and confirm the normal comparison jobs pass.

`npm run test:e2e:update` regenerates baselines locally for experiments only. Don't commit its output unless your host matches the CI image.

## Dependency updates

Use the shared npm script from the sibling Home Repo, run from this repo's root: `node ../home-repo/scripts/npm-deps.mjs <report|security|update>` (see `../home-repo/AGENTS.md`). Run `npm run check` after `security` or `update`. Keep the existing `overrides` and the nested-install fallback in mind: pass `--nested` if a hoisted install churns unrelated transitive lockfile entries.

## Site metadata and SITE_URL

- `public/index.html` holds the static SEO and Open Graph tags (title, description, `og:*`) so crawlers read them without JavaScript. Every SPA route shares this site-level metadata; don't add a runtime head manager for it.
- `SITE_URL` is an optional build variable read in `webpack.config.js`. It must be a public HTTPS origin with a dotted domain name (no IP address, localhost, path, query, fragment, or credentials); a trailing slash is stripped and invalid values fail the build. When set, the template adds `canonical`, `og:url`, `og:image` (the hashed `src/assets/mt-taranaki.jpg`, resolved via `require` in the template), and `og:image:alt`. When unset (local and CI builds), those URL tags are omitted.
- Netlify sets `SITE_URL` in `netlify.toml` (currently `https://ashcrockett.netlify.app`). Update it there when the custom domain is confirmed; a value in `netlify.toml` overrides one set in the Netlify UI.
- Test locally with a clearly fake origin, e.g. `SITE_URL=https://preview-test.example.com npm run build`, and check `dist/index.html`'s `og:image` names a JPG in `dist/`. Don't commit that output. `src/metadata.test.ts` covers the template and URL validation.
- After deploying, fetch the public HTML and the `og:image` URL with `curl -sI`; the image must return `content-type: image/jpeg`, not the SPA fallback HTML. Then run the URL through LinkedIn Post Inspector (https://www.linkedin.com/post-inspector/) to refresh LinkedIn's cache and check the card.
