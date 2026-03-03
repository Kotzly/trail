import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const EXTENSIONS = new Set(['.ts', '.tsx']);

type Failure = {
  file: string;
  reason: string;
};

function collectFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    const st = statSync(abs);
    if (st.isDirectory()) {
      out.push(...collectFiles(abs));
      continue;
    }
    if (EXTENSIONS.has(extname(abs))) {
      out.push(abs);
    }
  }
  return out;
}

function checkForbiddenImports(files: string[], rules: Array<{ pattern: RegExp; reason: string }>): Failure[] {
  const failures: Failure[] = [];
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    for (const rule of rules) {
      if (rule.pattern.test(src)) {
        failures.push({ file, reason: rule.reason });
      }
    }
  }
  return failures;
}

const sharedAndBackgroundFiles = [
  ...collectFiles('src/shared'),
  ...collectFiles('src/background'),
];

const fullviewFiles = collectFiles('src/entrypoints/fullview');

const failures: Failure[] = [
  ...checkForbiddenImports(sharedAndBackgroundFiles, [
    {
      pattern: /from\s+['\"]@entrypoints\//,
      reason: 'shared/background cannot import @entrypoints/*',
    },
    {
      pattern: /from\s+['\"][.]{1,2}\/.*entrypoints\//,
      reason: 'shared/background cannot import relative entrypoints/*',
    },
  ]),
  ...checkForbiddenImports(fullviewFiles, [
    {
      pattern: /from\s+['\"]@entrypoints\/sidepanel\//,
      reason: 'fullview cannot import @entrypoints/sidepanel/* directly',
    },
    {
      pattern: /from\s+['\"][.]{1,2}\/.*sidepanel\//,
      reason: 'fullview cannot import sidepanel/* via relative path',
    },
  ]),
];

assert.equal(
  failures.length,
  0,
  failures
    .map((f) => `- ${f.file}: ${f.reason}`)
    .join('\n'),
);

console.log('Architecture boundary checks passed');
