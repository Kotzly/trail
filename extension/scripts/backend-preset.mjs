#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

const PRESET_FILE = resolve(process.cwd(), 'public/backend-preset.json');
const VALID_PRESETS = new Set(['local', 'gettrail']);
const DEFAULT_PRESET = 'gettrail';

async function readCurrentPreset() {
  try {
    const raw = await readFile(PRESET_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed?.tag === 'local' ? 'local' : DEFAULT_PRESET;
  } catch {
    return DEFAULT_PRESET;
  }
}

async function writePreset(preset) {
  await mkdir(dirname(PRESET_FILE), { recursive: true });
  await writeFile(PRESET_FILE, `${JSON.stringify({ tag: preset }, null, 2)}\n`, 'utf8');
}

async function main() {
  const command = process.argv[2] ?? 'status';

  if (command === 'status') {
    const preset = await readCurrentPreset();
    console.log(`Backend preset: ${preset}`);
    return;
  }

  if (!VALID_PRESETS.has(command)) {
    console.error('Usage: node scripts/backend-preset.mjs <local|gettrail|status>');
    process.exit(1);
  }

  await writePreset(command);
  console.log(`Backend preset set to: ${command}`);
}

main().catch((error) => {
  console.error('Failed to update backend preset file:', error);
  process.exit(1);
});
