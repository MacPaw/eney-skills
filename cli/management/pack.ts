import { basename, dirname, join, resolve } from 'path';
import fs from 'fs/promises';
import { spawn } from 'child_process';
import { spawnSync } from 'child_process';
import { tmpdir } from 'os';
import { existsSync } from 'fs';

import { bundle } from '../bundle/command.ts';

export async function packExtension(cwd: string, out?: string) {
  const extensionDir = resolve(cwd);
  const extensionName = basename(extensionDir);
  const manifestPath = join(extensionDir, 'manifest.json');

  try {
    await fs.stat(extensionDir);
  } catch {
    throw new Error(`Directory not found: ${extensionDir}`);
  }

  let manifestVersion: string | undefined;

  try {
    const manifestRaw = await fs.readFile(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestRaw);
    manifestVersion = manifest.version;
  } catch (error: any) {
    throw new Error(`Unable to read manifest at ${manifestPath}: ${error.message}`);
  }

  if (!manifestVersion) {
    throw new Error(`Missing "version" field in manifest at ${manifestPath}`);
  }

  let outputDir = tmpdir();

  if (out) {
    outputDir = resolve(out);

    if (!existsSync(outputDir)) {
      await fs.mkdir(outputDir, { recursive: true });
    }
  }

  const archiveName = `${extensionName}@v${manifestVersion}.zip`;
  const archiveResultPath = join(outputDir, archiveName);

  const folderWithBundle = await bundle(cwd, "./dist");
  const parentFolderOfBundle = dirname(folderWithBundle);

  await fs.rm(archiveResultPath, { force: true }).catch(() => undefined);

  console.log(`Creating archive ${archiveName} in ${outputDir}...`);

  await new Promise<void>((resolve, reject) => {
    const tarProcess = spawn('tar', ['-czf', archiveResultPath, extensionName], {
      cwd: parentFolderOfBundle,
      stdio: 'inherit',
    });

    tarProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`tar exited with code ${code}`));
      }
    });

    tarProcess.on('error', (error) => {
      reject(error);
    });
  });

  console.log(`Archive created at ${archiveResultPath}`);

  return archiveResultPath;
}

export async function getFileHash(filePath: string) {
  const result = spawnSync('shasum', ['-a', '256', filePath], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`Failed to calculate sha256 hash: ${result.stderr}`);
  }
  // shasum outputs "<hash>  <filename>"
  const hash = result.stdout.split(' ')[0].trim();
  return hash;
}

export async function getFileDownloadUrl(filePath: string, mode: "staging" | "production" = "staging") {
  return `https://storage.googleapis.com/eney-assets/extensions/${mode}/${basename(filePath)}`;
}

export async function packExtensionCommand(cwd: string, outputDir?: string) {
  await packExtension(cwd, outputDir);
}
