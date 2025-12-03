import { basename, join } from 'path';
import fs from 'fs/promises';
import semver from 'semver';

import { ApiClient } from '../lib/api.ts';

export async function checkVersion(cwd: string, mode: "staging" | "production" = "staging") {
  const api = new ApiClient(mode);
  const extensionName = basename(cwd);

  const manifest = JSON.parse(await fs.readFile(join(cwd, 'manifest.json'), 'utf8'));
  const currentVersion = semver.coerce(manifest.version);

  try {
    const versions = await api.getExtensionVersions(extensionName);

    if (versions.length === 0) {
      console.log(`Extension ${extensionName} artifact versions not found, ready to publish`);
      return;
    }

    const versionList = versions.map((version) => semver.coerce(version.version)).sort((a, b) => semver.compare(b, a));
    const latestVersion = semver.coerce(versionList[0]);

    if (versionList.some((version) => semver.eq(version, currentVersion))) {
      throw new Error(`Version ${currentVersion} already exists! Please update the version in the manifest.json file.`);
    }

    if (!semver.valid(currentVersion)) {
      throw new Error(`Version ${currentVersion} is not a valid semver version! Please update the version in the manifest.json file.`);
    }

    if (semver.lt(currentVersion, latestVersion)) {
      throw new Error(`Version ${currentVersion} is less than the latest version ${versionList[0]}! Please update the version in the manifest.json file.`);
    }

    console.log(`Version ${currentVersion} does not exist, all good!`);
  } catch (error) {
    console.error(`\nError checking extension version!\n${error.message}`);
    process.exit(1);
  }
}

export async function checkVersionCommand(cwd: string, mode: "staging" | "production" = "staging") {
  await checkVersion(cwd, mode);
}
