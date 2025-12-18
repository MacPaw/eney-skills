#!/usr/bin/env node
// Bump version in manifest.json for extensions with changes
//
// Usage:
//   node scripts/bump-version-for-changed.js                       # Detect via git status (uncommitted changes)
//   node scripts/bump-version-for-changed.js --base <sha>          # Detect via git diff against base commit
//   node scripts/bump-version-for-changed.js --extension <name>    # Bump specific extension (skip detection)
//   node scripts/bump-version-for-changed.js --dry-run             # Preview without making changes

import { readdirSync, existsSync, readFileSync, openSync, writeSync, closeSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const baseIndex = args.indexOf('--base');
const baseSha = baseIndex !== -1 ? args[baseIndex + 1] : null;
const extIndex = args.indexOf('--extension');
const specificExtension = extIndex !== -1 ? args[extIndex + 1] : null;
const extensionsDir = join(import.meta.dirname, '../extensions');

if (dryRun) {
  console.log('Dry run mode - no changes will be made\n');
}

if (baseSha) {
  console.log(`Comparing against base commit: ${baseSha}\n`);
}

function hasChanges(extPath) {
  if (baseSha) {
    const diff = execSync(`git diff --name-only ${baseSha} HEAD -- "${extPath}"`, { encoding: 'utf8' });
    return diff.trim().length > 0;
  } else {
    const status = execSync(`git status --porcelain "${extPath}"`, { encoding: 'utf8' });
    return status.trim().length > 0;
  }
}

function bumpExtension(name) {
  const extPath = join(extensionsDir, name);
  const manifestPath = join(extPath, 'manifest.json');

  if (!existsSync(manifestPath)) {
    console.log(`=== ${name} ===`);
    console.log('  No manifest.json found, skipping\n');
    return false;
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
    const file = openSync(manifestPath, 'w');
    writeSync(file, JSON.stringify(manifest, null, '\t') + '\n');
    closeSync(file);
  }

  console.log('');
  return true;
}

let changedCount = 0;

if (specificExtension) {
  if (bumpExtension(specificExtension)) {
    changedCount++;
  }
} else {
  const extensions = readdirSync(extensionsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const name of extensions) {
    const extPath = join(extensionsDir, name);
    if (hasChanges(extPath) && bumpExtension(name)) {
      changedCount++;
    }
  }
}

if (changedCount === 0) {
  console.log('No extensions bumped.');
} else if (dryRun) {
  console.log(`Run without --dry-run to apply changes to ${changedCount} extension(s)`);
}
