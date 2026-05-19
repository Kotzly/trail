import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const ENTRYPOINTS_DIR = join(ROOT, 'src', 'entrypoints');
const SRC_DIR = join(ROOT, 'src');

const EXPECTED_ENTRYPOINT_FILES = [
  'background.ts',
  'content.ts',
  'login/index.html',
  'login/main.tsx',
  'settings/index.html',
  'settings/main.tsx',
  'sidepanel/index.html',
  'sidepanel/main.tsx',
].sort();

const REQUIRED_DIRECTORIES = [
  'src/apps',
  'src/ui',
  'src/features/graph',
  'src/apps/settings',
];

const FORBIDDEN_PATHS = [
  'src/ui-core',
  'src/spotlight',
  'src/shared/lib/spotlight',
  'src/entrypoints/fullview',
  'src/entrypoints/newtab',
  'src/entrypoints/offscreen-graph',
  'src/entrypoints/spotlight-content',
  'src/entrypoints/spotlight-graph',
  'src/apps/content-ui',
  'src/apps/fullview',
  'src/apps/newtab',
  'src/apps/spotlight-graph',
  'src/features/spotlight',
  'src/shared/graph-layout-cache',
];

const FORBIDDEN_IMPORT_PATTERNS = [
  '@entrypoints/sidepanel/ui',
  '@entrypoints/sidepanel/api',
  '@shared/lib/spotlight',
  '../src/spotlight/',
  '../../spotlight/',
  '../../../spotlight/',
  'spotlight.content',
  'src/ui-core',
  'pixi.js',
  'pixi',
];

function listFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(abs));
      continue;
    }
    files.push(relative(ENTRYPOINTS_DIR, abs));
  }

  return files.sort();
}

function listSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.output' || entry.name === '.wxt') continue;
      files.push(...listSourceFiles(abs));
      continue;
    }
    if (/\.(ts|tsx|css|json)$/u.test(entry.name)) {
      files.push(abs);
    }
  }

  return files.sort();
}

function testPackageRootHygiene(): void {
  for (const relPath of FORBIDDEN_PATHS) {
    assert.equal(
      existsSync(join(ROOT, relPath)),
      false,
      `legacy path must not exist: ${relPath}`,
    );
  }

  for (const relPath of REQUIRED_DIRECTORIES) {
    assert.equal(
      existsSync(join(ROOT, relPath)),
      true,
      `required package directory missing: ${relPath}`,
    );
  }

  console.log('  root hygiene: OK');
}

function testEntrypointsStayThin(): void {
  const actual = listFiles(ENTRYPOINTS_DIR);
  assert.deepEqual(
    actual,
    EXPECTED_ENTRYPOINT_FILES,
    'entrypoints must contain bootstrap files only',
  );
  console.log('  thin entrypoints: OK');
}

function testLegacyImportsAreGone(): void {
  const offenders: string[] = [];

  for (const file of listSourceFiles(SRC_DIR)) {
    const content = readFileSync(file, 'utf8');
    const hit = FORBIDDEN_IMPORT_PATTERNS.find((pattern) => content.includes(pattern));
    if (hit) {
      offenders.push(`${relative(ROOT, file)} -> ${hit}`);
    }
  }

  assert.deepEqual(offenders, [], `legacy import boundaries found:\n${offenders.join('\n')}`);
  console.log('  import boundaries: OK');
}

// Sidepanel must not depend on background OOP tree internals — the
// store has been rewritten to consume `treeJSON` + a precomputed
// TreeIndex, and consumers read from there. Re-introducing an import
// would reintroduce per-node Zod safeParse + TreeNode allocation on
// every cold open.
const SIDEPANEL_FORBIDDEN_BACKGROUND_IMPORTS = [
  '@background/state/nav-tree',
  '@background/state/pinned',
];

function testSidepanelBackgroundBoundary(): void {
  const sidepanelDir = join(SRC_DIR, 'apps', 'sidepanel');
  const offenders: string[] = [];

  for (const file of listSourceFiles(sidepanelDir)) {
    const content = readFileSync(file, 'utf8');
    const hit = SIDEPANEL_FORBIDDEN_BACKGROUND_IMPORTS.find((pattern) =>
      content.includes(pattern),
    );
    if (hit) {
      offenders.push(`${relative(ROOT, file)} -> ${hit}`);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `sidepanel must not import background OOP tree internals:\n${offenders.join('\n')}`,
  );
  console.log('  sidepanel/background boundary: OK');
}

function testProdManifestNoDev(): void {
  const manifestPath = join(ROOT, '.output', 'chrome-mv3', 'manifest.json');

  if (!existsSync(manifestPath)) {
    console.log('  prod manifest no-dev: SKIPPED (not built)');
    return;
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const hostPermissions: string[] = manifest.host_permissions ?? [];

  const devPatterns = hostPermissions.filter(
    (hp) =>
      hp.includes('localhost') ||
      hp.includes('127.0.0.1') ||
      hp.startsWith('http://'),
  );

  assert.deepEqual(
    devPatterns,
    [],
    `prod manifest must not contain dev origins: ${devPatterns.join(', ')}`,
  );

  console.log('  prod manifest no-dev: OK');
}

function run(): void {
  console.log('Running architecture-boundaries.test.ts...');
  testPackageRootHygiene();
  testEntrypointsStayThin();
  testLegacyImportsAreGone();
  testSidepanelBackgroundBoundary();
  testProdManifestNoDev();
}

run();
console.log('architecture-boundaries.test.ts passed');
