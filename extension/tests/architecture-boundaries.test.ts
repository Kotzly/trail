import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const ENTRYPOINTS_DIR = join(ROOT, 'src', 'entrypoints');
const SRC_DIR = join(ROOT, 'src');

const EXPECTED_ENTRYPOINT_FILES = [
  'account/index.html',
  'account/main.tsx',
  'background.ts',
  'content.ts',
  'fullview/index.html',
  'fullview/main.tsx',
  'newtab/index.html',
  'newtab/main.tsx',
  'offscreen-graph/index.html',
  'offscreen-graph/main.ts',
  'sidepanel/index.html',
  'sidepanel/main.tsx',
  'spotlight-content/index.tsx',
  'spotlight-content/style.css',
  'spotlight-graph/index.html',
  'spotlight-graph/main.tsx',
].sort();

const REQUIRED_DIRECTORIES = [
  '.meta/planning',
  'src/apps',
  'src/ui',
  'src/features/spotlight/model',
  'src/features/spotlight/ui',
  'src/features/graph/components/graph',
  'src/features/graph/graph',
];

const FORBIDDEN_PATHS = [
  '.claude',
  '.planning',
  'dist',
  'logs',
  'pnpm-lock.yaml',
  'tasks',
  'src/ui-core',
  'src/spotlight',
  'src/shared/lib/spotlight',
  'src/entrypoints/account/ui',
  'src/entrypoints/content-ui',
  'src/entrypoints/fullview/ui',
  'src/entrypoints/newtab/ui',
  'src/entrypoints/sidepanel/api',
  'src/entrypoints/sidepanel/ui',
  'src/entrypoints/spotlight.content',
  'src/entrypoints/spotlight-graph/SpotlightGraphApp.tsx',
  'src/apps/sidepanel/ui/components/AuthGate.tsx',
  'src/apps/sidepanel/ui/components/WelcomeGate.tsx',
  'src/shared/debug',
  'src/apps/newtab/ui/BookmarksBar.tsx',
  'src/apps/sidepanel/ui/components/SearchBar.tsx',
  'src/apps/sidepanel/ui/components/TabInfo.tsx',
  'src/apps/sidepanel/ui/components/ui/demo.tsx',
  'src/apps/sidepanel/ui/components/ui/sidebar.tsx',
  'src/apps/sidepanel/ui/components/ui/sidebar-utils.ts',
  'src/ui/components/liquid-glass.tsx',
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

function run(): void {
  console.log('Running architecture-boundaries.test.ts...');
  testPackageRootHygiene();
  testEntrypointsStayThin();
  testLegacyImportsAreGone();
}

run();
console.log('architecture-boundaries.test.ts passed');
