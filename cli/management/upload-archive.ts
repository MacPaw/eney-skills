import { basename, join, resolve } from "path";
import fs from "fs/promises";
import * as p from "@clack/prompts";

import { ApiClient } from "../lib/api.ts";
import { getFileDownloadUrl, getFileHash, packExtension } from "./pack.ts";

type UploadArchiveOptions = {
  cwd?: string;
  mode?: "staging" | "production";
  dryRun?: boolean;
};

async function promptForOptions(options: UploadArchiveOptions) {
  p.intro("Upload Archive");

  const answers = await p.group(
    {
      cwd: () =>
        options.cwd
          ? Promise.resolve(options.cwd)
          : p.text({
              message: "Extension directory:",
              initialValue: process.cwd(),
            }),
      mode: () =>
        options.mode
          ? Promise.resolve(options.mode)
          : p.select({
              message: "Upload mode:",
              options: [
                { value: "staging", label: "Staging" },
                { value: "production", label: "Production" },
              ],
            }),
      dryRun: () =>
        options.dryRun !== undefined
          ? Promise.resolve(options.dryRun)
          : p.confirm({
              message: "Dry run (skip remote upload)?",
              initialValue: false,
            }),
    },
    {
      onCancel: () => {
        p.cancel("Operation cancelled.");
        process.exit(0);
      },
    },
  );

  return {
    cwd: answers.cwd as string,
    mode: answers.mode as "staging" | "production",
    dryRun: answers.dryRun as boolean,
  };
}

async function uploadArchive(cwd: string, mode: "staging" | "production", dryRun: boolean) {
  const api = new ApiClient(mode);
  const extensionDir = resolve(cwd);
  const extensionName = basename(extensionDir);

  const manifestRaw = await fs.readFile(join(extensionDir, "manifest.json"), "utf8");
  const manifest = JSON.parse(manifestRaw);
  const version = manifest.version;

  console.log(`Packing extension ${extensionName}@${version}...`);
  const archivePath = await packExtension(cwd);

  console.log("Calculating file hash...");
  const hash = await getFileHash(archivePath);
  const downloadUrl = await getFileDownloadUrl(archivePath, mode);

  console.log(`Archive: ${archivePath}`);
  console.log(`Hash: ${hash}`);
  console.log(`Download URL: ${downloadUrl}`);

  if (dryRun) {
    console.log("Dry run enabled: skipping upload to cloud.");
    await fs.rm(archivePath, { force: true });
    return;
  }

  try {
    await api.uploadExtensionArchiveToCloud(archivePath);
    console.log("Archive uploaded successfully to cloud storage.");
  } catch (error) {
    console.error("Error uploading archive to cloud:", error);
    await fs.rm(archivePath, { force: true });
    throw error;
  }

  await fs.rm(archivePath, { force: true });

  // Output for GitHub Actions
  if (process.env.GITHUB_OUTPUT) {
    await fs.appendFile(process.env.GITHUB_OUTPUT, `extension_name=${extensionName}\n`);
    await fs.appendFile(process.env.GITHUB_OUTPUT, `version=${version}\n`);
    await fs.appendFile(process.env.GITHUB_OUTPUT, `hash=${hash}\n`);
    await fs.appendFile(process.env.GITHUB_OUTPUT, `download_url=${downloadUrl}\n`);
    console.log("\nGitHub Actions outputs set:");
    console.log(`  extension_name: ${extensionName}`);
    console.log(`  version: ${version}`);
    console.log(`  hash: ${hash}`);
    console.log(`  download_url: ${downloadUrl}`);
  }
}

export async function uploadArchiveCommand(cwd?: string, mode?: "staging" | "production", dryRun?: boolean) {
  const hasAllOptions = cwd !== undefined && mode !== undefined;
  const isCI = process.env.CI === "true";

  if (hasAllOptions) {
    await uploadArchive(cwd, mode, dryRun);
  } else if (isCI) {
    console.error("Error: --cwd and --mode are required in CI mode");
    process.exit(1);
  } else {
    const resolved = await promptForOptions({ cwd, mode, dryRun });
    await uploadArchive(resolved.cwd, resolved.mode, resolved.dryRun);
  }
}
