#!/usr/bin/env node
// Deterministic dependency maintenance for the weekly automation.
//
//   node scripts/deps.mjs report              advisories + outdated direct deps (no changes)
//   node scripts/deps.mjs security [--nested] npm audit fix (never --force), then fixed/remaining tables
//   node scripts/deps.mjs update [--nested] [--exclude a,b]
//                                             bump direct deps to the newest release in their current major
//
// --nested regenerates the lockfile with --install-strategy=nested (then npm ci) to avoid
// unrelated transitive churn. --json prints machine-readable output instead of Markdown.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const REGISTRY = (process.env.npm_config_registry || 'https://registry.npmjs.org').replace(
  /\/$/,
  '',
);
const SEVERITY_ORDER = ['critical', 'high', 'moderate', 'low', 'info'];

const args = process.argv.slice(2);
const command = args.find((a) => !a.startsWith('--')) ?? 'report';
const flag = (name) => args.includes(`--${name}`);
const option = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

const npm = (npmArgs, { allowFailure = false } = {}) => {
  try {
    return execFileSync('npm', npmArgs, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    // npm audit exits non-zero when it finds vulnerabilities but still prints JSON.
    if (allowFailure && error.stdout) return error.stdout;
    throw error;
  }
};

const parseVersion = (v) => {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+.*)?$/.exec(v);
  return m ? { major: +m[1], minor: +m[2], patch: +m[3], pre: m[4] } : undefined;
};

const compare = (a, b) => {
  const x = parseVersion(a);
  const y = parseVersion(b);
  return x.major - y.major || x.minor - y.minor || x.patch - y.patch;
};

// Same "compatible release" rule as a caret range: 0.x minors are breaking.
const sameLine = (a, b) => a.major === b.major && (a.major !== 0 || a.minor === b.minor);

const classify = (from, to) => {
  const a = parseVersion(from);
  const b = parseVersion(to);
  if (!sameLine(a, b)) return 'major';
  return a.minor === b.minor ? 'patch' : 'minor';
};

const fetchPackument = async (name) => {
  const res = await fetch(`${REGISTRY}/${name.replace('/', '%2F')}`, {
    headers: { accept: 'application/vnd.npm.install-v1+json' },
  });
  if (!res.ok) throw new Error(`${name}: registry returned ${res.status}`);
  return res.json();
};

const directDependencies = () => {
  const pkg = readJson('package.json');
  const lock = readJson('package-lock.json');
  const deps = [];
  for (const [field, kind] of [
    ['dependencies', 'prod'],
    ['devDependencies', 'dev'],
  ]) {
    for (const [name, spec] of Object.entries(pkg[field] ?? {})) {
      const current = lock.packages?.[`node_modules/${name}`]?.version;
      deps.push({ name, spec, field, kind, current });
    }
  }
  return deps;
};

const outdated = async () => {
  const deps = directDependencies();
  const results = await Promise.all(
    deps.map(async (dep) => {
      if (!dep.current || !parseVersion(dep.current) || !/^[~^]?\d+\.\d+\.\d+$/.test(dep.spec)) {
        return { ...dep, skipped: `unsupported spec "${dep.spec}"` };
      }
      const doc = await fetchPackument(dep.name);
      const current = parseVersion(dep.current);
      const stable = Object.keys(doc.versions).filter(
        (v) => parseVersion(v) && !parseVersion(v).pre,
      );
      const inLine = stable.filter(
        (v) => sameLine(parseVersion(v), current) && compare(v, dep.current) > 0,
      );
      const target = inLine.sort(compare).at(-1);
      const latest = doc['dist-tags']?.latest;
      const major =
        latest &&
        parseVersion(latest) &&
        compare(latest, dep.current) > 0 &&
        !sameLine(parseVersion(latest), current)
          ? latest
          : undefined;
      return { ...dep, target, type: target && classify(dep.current, target), major };
    }),
  );
  return {
    updates: results.filter((d) => d.target),
    majors: results.filter((d) => d.major),
    skipped: results.filter((d) => d.skipped),
  };
};

const audit = (omitDev) => {
  const out = npm(['audit', '--json', ...(omitDev ? ['--omit=dev'] : [])], { allowFailure: true });
  return JSON.parse(out).vulnerabilities ?? {};
};

// One row per (package, advisory) pair, flattened from npm audit's vulnerability tree.
const advisories = () => {
  const all = audit(false);
  const prodNames = new Set(Object.keys(audit(true)));
  const rows = [];
  for (const vuln of Object.values(all)) {
    const fix = vuln.fixAvailable;
    const fixable = fix === true || (typeof fix === 'object' && !fix.isSemVerMajor);
    const fixNote =
      fix === true
        ? 'npm audit fix'
        : typeof fix === 'object'
          ? `${fix.name}@${fix.version}${fix.isSemVerMajor ? ' (major)' : ''}`
          : 'no fix available';
    for (const via of vuln.via) {
      if (typeof via !== 'object') continue;
      rows.push({
        package: vuln.name,
        severity: via.severity,
        id: via.url?.split('/').pop() ?? String(via.source),
        title: via.title,
        range: via.range,
        scope: prodNames.has(vuln.name) ? 'production' : 'dev-only',
        fixable,
        fix: fixNote,
        fixName: typeof fix === 'object' ? fix.name : undefined,
        fixVersion: typeof fix === 'object' && !fix.isSemVerMajor ? fix.version : undefined,
      });
    }
  }
  return rows.sort(
    (a, b) =>
      SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) ||
      a.package.localeCompare(b.package),
  );
};

const table = (headers, rows) =>
  rows.length === 0
    ? '_None._\n'
    : [
        `| ${headers.join(' | ')} |`,
        `|${headers.map(() => '---').join('|')}|`,
        ...rows.map((r) => `| ${r.join(' | ')} |`),
      ].join('\n') + '\n';

const advisoryTable = (rows) =>
  table(
    ['Package', 'Severity', 'Advisory', 'Scope', 'Fix'],
    rows.map((r) => [
      `\`${r.package}\``,
      r.severity,
      `[${r.id}](https://github.com/advisories/${r.id}) ${r.title}`,
      r.scope,
      r.fix,
    ]),
  );

const updateTable = (rows) =>
  table(
    ['Package', 'From', 'To', 'Type'],
    rows.map((d) => [`\`${d.name}\``, d.current, d.target, d.type]),
  );

const majorTable = (rows) =>
  table(
    ['Package', 'Current', 'Latest', 'Key breaking changes', 'Estimated effort'],
    rows.map((d) => [`\`${d.name}\``, d.current, d.major, 'TODO', 'TODO']),
  );

const severityCounts = (rows) => {
  const counts = Object.fromEntries(SEVERITY_ORDER.map((s) => [s, 0]));
  for (const r of rows) counts[r.severity] += 1;
  return (
    SEVERITY_ORDER.filter((s) => counts[s])
      .map((s) => `${counts[s]} ${s}`)
      .join(', ') || 'none'
  );
};

const regenerateLockfile = () => {
  if (flag('nested')) {
    npm(['install', '--package-lock-only', '--install-strategy=nested', '--no-audit', '--no-fund']);
    npm(['ci', '--no-audit', '--no-fund']);
  } else {
    npm(['install', '--no-audit', '--no-fund']);
  }
};

const print = (json, markdown) =>
  process.stdout.write(flag('json') ? JSON.stringify(json, null, 2) + '\n' : markdown);

const report = async () => {
  const advs = advisories();
  const { updates, majors, skipped } = await outdated();
  const fixable = advs.filter((a) => a.fixable);
  print(
    { advisories: advs, updates, majors, skipped, work: fixable.length > 0 || updates.length > 0 },
    [
      `## Advisories (${severityCounts(advs)})`,
      advisoryTable(advs),
      '## Patch and minor updates',
      updateTable(updates),
      '## Major updates available',
      majorTable(majors),
      ...(skipped.length
        ? ['## Skipped', skipped.map((d) => `- \`${d.name}\`: ${d.skipped}`).join('\n') + '\n']
        : []),
    ].join('\n'),
  );
};

const security = () => {
  const before = advisories();
  if (!before.some((a) => a.fixable)) {
    print(
      { fixed: [], remaining: before },
      `No fixable advisories (${severityCounts(before)}).\n\n${advisoryTable(before)}`,
    );
    return;
  }
  // Exits non-zero while anything stays vulnerable, so check the result by re-auditing.
  npm(['audit', 'fix', '--no-fund'], { allowFailure: true });

  // npm audit fix won't move an exact or narrow direct pin; bump those within their major.
  const pkg = readJson('package.json');
  let bumped = false;
  for (const a of advisories().filter((r) => r.fixable && r.fixVersion)) {
    const field = ['dependencies', 'devDependencies'].find((f) => pkg[f]?.[a.fixName]);
    if (!field) continue;
    const spec = pkg[field][a.fixName];
    const prefix = /^[~^]/.exec(spec)?.[0] ?? '';
    const pinned = spec.replace(/^[~^]/, '');
    if (parseVersion(pinned) && compare(a.fixVersion, pinned) > 0) {
      pkg[field][a.fixName] = `${prefix}${a.fixVersion}`;
      bumped = true;
    }
  }
  if (bumped) {
    writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
    regenerateLockfile();
  } else if (flag('nested')) {
    regenerateLockfile();
  }

  const after = advisories();
  const key = (a) => `${a.package} ${a.id}`;
  const remainingKeys = new Set(after.map(key));
  const fixed = before.filter((a) => !remainingKeys.has(key(a)));
  print(
    { fixed, remaining: after },
    [
      `## Advisories fixed (${severityCounts(fixed)})`,
      advisoryTable(fixed),
      `## Advisories not fixed (${severityCounts(after)})`,
      advisoryTable(after),
      ...(after.some((a) => a.fixable)
        ? ['Rows with a non-major fix still listed need an `overrides` entry or a parent bump.\n']
        : []),
    ].join('\n'),
  );
};

const update = async () => {
  const exclude = new Set((option('exclude') ?? '').split(',').filter(Boolean));
  const { updates, majors } = await outdated();
  const applied = updates.filter((d) => !exclude.has(d.name));
  if (applied.length > 0) {
    const pkg = readJson('package.json');
    for (const d of applied) {
      const prefix = /^[~^]/.exec(d.spec)?.[0] ?? '';
      pkg[d.field][d.name] = `${prefix}${d.target}`;
    }
    writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
    regenerateLockfile();
  }
  const left = updates.filter((d) => exclude.has(d.name));
  print(
    { applied, excluded: left, majors },
    [
      '## Patch and minor updates',
      updateTable(applied),
      ...(left.length
        ? [
            '## Left out',
            left.map((d) => `- \`${d.name}\` ${d.current} → ${d.target}: TODO reason`).join('\n') +
              '\n',
          ]
        : []),
      '## Major updates available',
      majorTable(majors),
    ].join('\n'),
  );
};

const commands = { report, security, update };
if (!commands[command]) {
  console.error(`Unknown command "${command}". Use: ${Object.keys(commands).join(', ')}`);
  process.exit(2);
}
await commands[command]();
