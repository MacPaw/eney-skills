import { basename, dirname, join, resolve } from 'path';
import fs from 'fs/promises';
import { spawn } from 'child_process';

export async function packExtensionCommand(cwd: string, outputDir?: string) {
  const extensionDir = resolve(cwd);
  const extensionName = basename(extensionDir);
  const parentDir = dirname(extensionDir);
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

  const archiveName = `${extensionName}@v${manifestVersion}.zip`;
  const archiveBaseDir = outputDir ? resolve(outputDir) : parentDir;
  const archivePath = join(archiveBaseDir, archiveName);

  await fs.mkdir(archiveBaseDir, { recursive: true });

  await fs.rm(archivePath, { force: true }).catch(() => undefined);

  console.log(`Creating archive ${archiveName} in ${archiveBaseDir}...`);

  const tarOutputPath = outputDir ? archivePath : archiveName;

  await new Promise<void>((resolve, reject) => {
    const tarProcess = spawn('tar', ['-czf', tarOutputPath, extensionName], {
      cwd: parentDir,
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

  console.log(`Archive created at ${archivePath}`);
}

