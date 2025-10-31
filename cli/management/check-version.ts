import { basename, join } from 'path';
import fs from 'fs/promises';
import semver from 'semver';

const backendUrl = process.env.BACKEND_URL;
const accessToken = process.env.ADMIN_AUTH_TOKEN;

type ExtensionVersion = {
  artifactType: 'extension';
  artifactId: string;
  version: string;
  hash: string;
  downloadUrl: string;
  createdAt: string;
}

export async function checkVersion(cwd: string) {
  const extensionName = basename(cwd);

  const manifest = JSON.parse(await fs.readFile(join(cwd, 'manifest.json'), 'utf8'));
  const currentVersion = manifest.version;

  console.log(`Current version: ${currentVersion}`);

  if (!backendUrl || !accessToken) {
		throw new Error('BACKEND_URL and ADMIN_AUTH_TOKEN must be set');
	}
	
  try {
    const response = await fetch(`${backendUrl}/admin/v3/artifacts/extension/${extensionName}/versions`, {
      method: 'GET',
      headers: {
        'X-API-Token': accessToken,
      },
    });
  
    if (!response.ok) {
      throw new Error(`Failed to get extension versions: ${response.status} ${response.statusText}`);
    }
  
    const data: ExtensionVersion[] = await response.json();
  
    const versionList = data.map((version) => version.version).sort((a, b) => semver.compare(b, a));
    const latestVersion = versionList[0];
  
    if (versionList.includes(currentVersion)) {
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
