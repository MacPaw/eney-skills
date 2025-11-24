import { basename, dirname, join, resolve } from 'path';
import fs from 'fs/promises';
import { spawn } from 'child_process';
import { createHash } from 'crypto';
import { tmpdir } from 'os';

import { bundle } from '../bundle/command.ts';
import { existsSync } from 'fs';

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
  const fileBuffer = await fs.readFile(filePath);
  return createHash('sha256').update(fileBuffer).digest('hex');
}

export async function getFileDownloadUrl(filePath: string) {
  return `https://storage.googleapis.com/eney-assets/extensions/${basename(filePath)}`;
}

export async function packExtensionCommand(cwd: string, outputDir?: string) {
  await packExtension(cwd, outputDir);
}
