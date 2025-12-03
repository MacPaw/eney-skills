#!/usr/bin/env node
// Bump version in manifest.json only for extensions with uncommitted changes
// Usage: node scripts/bump-version-for-changed.js
//        node scripts/bump-version-for-changed.js --dry-run

import { readdirSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const dryRun = process.argv.includes('--dry-run');
const extensionsDir = join(import.meta.dirname, '../extensions');

if (dryRun) {
  console.log('Dry run mode - no changes will be made\n');
}

const extensions = readdirSync(extensionsDir, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name);

let changedCount = 0;

for (const name of extensions) {
  const extPath = join(extensionsDir, name);
  const manifestPath = join(extPath, 'manifest.json');

  const status = execSync(`git status --porcelain "${extPath}"`, { encoding: 'utf8' });

  if (status.trim()) {
    if (!existsSync(manifestPath)) {
      console.log(`=== ${name} ===`);
      console.log('  No manifest.json found, skipping\n');
      continue;
    }

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const currentVersion = manifest.version;

    const parts = currentVersion.split('.');
    parts[parts.length - 1] = String(Number(parts[parts.length - 1]) + 1);
    const newVersion = parts.join('.');

    console.log(`=== ${name} ===`);
    console.log(`  ${currentVersion} -> ${newVersion}`);

    if (!dryRun) {
      manifest.version = newVersion;
      writeFileSync(manifestPath, JSON.stringify(manifest, null, '\t') + '\n');
    }

    changedCount++;
    console.log('');
  }
}

if (changedCount === 0) {
  console.log('No extensions with changes found.');
} else if (dryRun) {
  console.log(`Run without --dry-run to apply changes to ${changedCount} extension(s)`);
}
