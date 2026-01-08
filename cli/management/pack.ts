import { basename, dirname, join, resolve } from "path";
import fs from "fs/promises";
import { spawn, spawnSync } from "child_process";
import { tmpdir } from "os";
import { existsSync } from "fs";
import * as p from "@clack/prompts";

import { bundle } from "../bundle/command.ts";

export async function packExtension(cwd: string, out?: string) {
  const extensionDir = resolve(cwd);
  const extensionName = basename(extensionDir);
  const manifestPath = join(extensionDir, "manifest.json");
  const packageJsonPath = join(extensionDir, "package.json");

  try {
    await fs.stat(extensionDir);
  } catch {
    throw new Error(`Directory not found: ${extensionDir}`);
  }

  let manifestVersion: string | undefined;

  try {
    const manifestRaw = await fs.readFile(manifestPath, "utf8");
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

  await fs.cp(packageJsonPath, join(folderWithBundle, "package.json"));

  await fs.rm(archiveResultPath, { force: true }).catch(() => undefined);

  console.log(`Creating archive ${archiveName} in ${outputDir}...`);

  await new Promise<void>((resolve, reject) => {
    const tarProcess = spawn("tar", ["-czf", archiveResultPath, extensionName], {
      cwd: parentFolderOfBundle,
      stdio: "inherit",
    });

    tarProcess.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`tar exited with code ${code}`));
      }
    });

    tarProcess.on("error", (error) => {
      reject(error);
    });
  });

  console.log(`Archive created at ${archiveResultPath}`);

  return archiveResultPath;
}

export async function getFileHash(filePath: string) {
  const result = spawnSync("shasum", ["-a", "256", filePath], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`Failed to calculate sha256 hash: ${result.stderr}`);
  }
  // shasum outputs "<hash>  <filename>"
  const hash = result.stdout.split(" ")[0].trim();
  return hash;
}

export async function getFileDownloadUrl(filePath: string, mode: "staging" | "production" = "staging") {
  return mode === "production"
    ? `https://cdn.eney.ai/extensions/${basename(filePath)}`
    : `https://staging-cdn.eney.ai/extensions/${basename(filePath)}`;
}

type PackOptions = {
  cwd?: string;
  output?: string;
};

async function promptForOptions(options: PackOptions) {
  p.intro("Pack Extension");

  const answers = await p.group(
    {
      cwd: () =>
        options.cwd
          ? Promise.resolve(options.cwd)
          : p.text({
              message: "Extension directory:",
              initialValue: process.cwd(),
            }),
      output: () =>
        options.output
          ? Promise.resolve(options.output)
          : p.text({
              message: "Output directory (leave empty for temp):",
              placeholder: "Leave empty for temp directory",
            }),
    },
    {
      onCancel: () => {
        p.cancel("Operation cancelled.");
        process.exit(0);
      },
    }
  );

  return {
    cwd: answers.cwd as string,
    output: (answers.output as string) || undefined,
  };
}

export async function packExtensionCommand(cwd?: string, output?: string) {
  const isCI = process.env.CI === "true";

  if (cwd !== undefined) {
    await packExtension(cwd, output);
  } else if (isCI) {
    console.error("Error: --cwd is required in CI mode");
    process.exit(1);
  } else {
    const resolved = await promptForOptions({ cwd, output });
    await packExtension(resolved.cwd, resolved.output);
  }
}
