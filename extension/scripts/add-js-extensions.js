#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src');

/**
 * Recursively find all .ts files in a directory
 */
function findTsFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      findTsFiles(filePath, fileList);
    } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
      fileList.push(filePath);
    }
  }
  
  return fileList;
}

/**
 * Add .js extension to relative imports in TypeScript files
 */
function addJsExtensions() {
  console.log('Finding all TypeScript files...');
  
  // Find all .ts files in src directory
  const files = findTsFiles(srcDir);

  console.log(`Found ${files.length} TypeScript files`);

  let totalChanges = 0;

  for (const filePath of files) {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;
    let fileChanges = 0;

    // Pattern 1: import ... from './path' or '../path'
    // Matches: import { x } from './path' or import type { x } from '../path'
    const fromPattern = /from\s+['"](\.\.?\/[^'"]*?)(?<!\.js)(?<!\.json)(?<!\.css)(?<!\.html)['"]/g;
    content = content.replace(fromPattern, (match, importPath) => {
      // Skip if already has extension or is a non-JS import
      if (importPath.endsWith('.js') || 
          importPath.endsWith('.json') || 
          importPath.endsWith('.css') || 
          importPath.endsWith('.html') ||
          importPath.endsWith('.svg')) {
        return match;
      }
      changed = true;
      fileChanges++;
      return match.replace(importPath, importPath + '.js');
    });

    // Pattern 2: import './path' (side-effect imports)
    // Matches: import './path' at the start of line
    const sideEffectPattern = /^(\s*)import\s+['"](\.\.?\/[^'"]*?)(?<!\.js)(?<!\.json)(?<!\.css)(?<!\.html)['"]/gm;
    content = content.replace(sideEffectPattern, (match, indent, importPath) => {
      // Skip if already has extension or is a non-JS import
      if (importPath.endsWith('.js') || 
          importPath.endsWith('.json') || 
          importPath.endsWith('.css') || 
          importPath.endsWith('.html') ||
          importPath.endsWith('.svg')) {
        return match;
      }
      changed = true;
      fileChanges++;
      return `${indent}import '${importPath}.js'`;
    });

    // Pattern 3: import('path') (dynamic imports)
    const dynamicPattern = /import\s*\(\s*['"](\.\.?\/[^'"]*?)(?<!\.js)(?<!\.json)(?<!\.css)(?<!\.html)['"]\s*\)/g;
    content = content.replace(dynamicPattern, (match, importPath) => {
      // Skip if already has extension or is a non-JS import
      if (importPath.endsWith('.js') || 
          importPath.endsWith('.json') || 
          importPath.endsWith('.css') || 
          importPath.endsWith('.html') ||
          importPath.endsWith('.svg')) {
        return match;
      }
      changed = true;
      fileChanges++;
      return match.replace(importPath, importPath + '.js');
    });

    if (changed) {
      fs.writeFileSync(filePath, content, 'utf8');
      const relativePath = path.relative(srcDir, filePath);
      console.log(`  ✓ ${relativePath} (${fileChanges} imports fixed)`);
      totalChanges += fileChanges;
    }
  }

  console.log(`\nDone! Fixed ${totalChanges} imports across ${files.length} files.`);
}

try {
  addJsExtensions();
} catch (error) {
  console.error('Error:', error);
  process.exit(1);
}
