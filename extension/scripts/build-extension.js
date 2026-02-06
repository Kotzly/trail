#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const publicDir = path.join(__dirname, '..', 'public');
const backendPresetTag = process.env.TRAIL_EXTENSION_BACKEND_TAG === 'local' ? 'local' : 'production';

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Copy and transform manifest.json
console.log('Copying and transforming manifest.json...');
const manifestPath = path.join(publicDir, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// Update paths to be relative to dist root
manifest.background.service_worker = 'background/service-worker.js';
manifest.content_scripts[0].js = ['content/content-script.js'];
manifest.side_panel.default_path = 'sidepanel/sidepanel.html';

// Fix icon paths - use trail-*.png naming
manifest.icons = {
  '16': 'icons/trail-16.png',
  '32': 'icons/trail-32.png',
  '48': 'icons/trail-48.png',
  '128': 'icons/trail-128.png'
};

manifest.action.default_icon = {
  '16': 'icons/trail-16.png',
  '32': 'icons/trail-32.png',
  '48': 'icons/trail-48.png'
};

// Write transformed manifest to dist
fs.writeFileSync(
  path.join(distDir, 'manifest.json'),
  JSON.stringify(manifest, null, 2),
  'utf8'
);

// Copy icons directory
console.log('Copying icons...');
const iconsSourceDir = path.join(publicDir, 'icons');
const iconsDestDir = path.join(distDir, 'icons');

if (!fs.existsSync(iconsDestDir)) {
  fs.mkdirSync(iconsDestDir, { recursive: true });
}

const iconFiles = fs.readdirSync(iconsSourceDir);
iconFiles.forEach(file => {
  if (file.endsWith('.png')) {
    fs.copyFileSync(
      path.join(iconsSourceDir, file),
      path.join(iconsDestDir, file)
    );
  }
});

console.log('Build extension assets complete!');
console.log('Extension ready to load from dist/ directory.');

const backendPresetPath = path.join(distDir, 'backend-preset.json');
fs.writeFileSync(
  backendPresetPath,
  JSON.stringify({ tag: backendPresetTag }, null, 2),
  'utf8'
);
console.log(`Wrote backend preset: ${backendPresetTag}`);
