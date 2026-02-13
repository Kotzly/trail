#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const extensionRoot = path.resolve(__dirname, '..');
const workerEntrypoint = path.join(
  extensionRoot,
  'dist',
  'background',
  'service-worker.js',
);

if (!fs.existsSync(workerEntrypoint)) {
  console.error(
    `Missing service worker entrypoint: ${path.relative(extensionRoot, workerEntrypoint)}`,
  );
  process.exit(1);
}

const visited = new Set();
const stack = [workerEntrypoint];
const missing = [];

function extractImports(source) {
  const imports = new Set();
  const patterns = [
    /\bimport\s+(?:[^"'()]*?\s+from\s+)?["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\bexport\s+[^"']*?\s+from\s+["']([^"']+)["']/g,
  ];

  for (const pattern of patterns) {
    let match = pattern.exec(source);
    while (match) {
      imports.add(match[1]);
      match = pattern.exec(source);
    }
  }

  return Array.from(imports);
}

function resolveRelativeImport(fromFile, specifier) {
  const basePath = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    basePath,
    `${basePath}.js`,
    path.join(basePath, 'index.js'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  return null;
}

while (stack.length > 0) {
  const current = stack.pop();
  if (!current || visited.has(current)) {
    continue;
  }
  visited.add(current);

  const source = fs.readFileSync(current, 'utf8');
  const imports = extractImports(source);

  for (const specifier of imports) {
    if (!(specifier.startsWith('./') || specifier.startsWith('../'))) {
      continue;
    }

    const resolved = resolveRelativeImport(current, specifier);
    if (!resolved) {
      missing.push({
        from: path.relative(extensionRoot, current),
        specifier,
      });
      continue;
    }

    if (!visited.has(resolved)) {
      stack.push(resolved);
    }
  }
}

if (missing.length > 0) {
  console.error('MISSING_RELATIVE_IMPORTS');
  for (const entry of missing) {
    console.error(`${entry.from} -> ${entry.specifier}`);
  }
  process.exit(1);
}

console.log('NO_MISSING_RELATIVE_IMPORTS');
