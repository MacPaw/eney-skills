import { join, resolve } from "path";
import fs from "fs/promises";
import * as p from "@clack/prompts";

import { ApiClient, getMcpFileDownloadUrl } from "../lib/api.ts";
import { getFileHash, packMcp } from "./pack-mcp.ts";

type UploadMcpArchiveOptions = {
  cwd?: string;
  mode?: "staging" | "production";
  dryRun?: boolean;
};

async function promptForOptions(options: UploadMcpArchiveOptions) {
  p.intro("Upload MCP Archive");

  const answers = await p.group(
    {
      cwd: () =>
        options.cwd
          ? Promise.resolve(options.cwd)
          : p.text({
              message: "MCP server directory:",
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

async function uploadMcpArchive(cwd: string, mode: "staging" | "production", dryRun: boolean) {
  const api = new ApiClient(mode);
  const mcpDir = resolve(cwd);

  const manifestRaw = await fs.readFile(join(mcpDir, "manifest.json"), "utf8");
  const manifest = JSON.parse(manifestRaw);
  const mcpName = manifest.name;
  const version = manifest.version;

  console.log(`Packing MCP ${mcpName}@v${version}...`);
  const archivePath = await packMcp(cwd);

  console.log("Calculating file hash...");
  const hash = await getFileHash(archivePath);
  const downloadUrl = getMcpFileDownloadUrl(archivePath, mode);

  console.log(`Archive: ${archivePath}`);
  console.log(`Hash: ${hash}`);
  console.log(`Download URL: ${downloadUrl}`);

  if (dryRun) {
    console.log("Dry run enabled: skipping upload to cloud.");
    await fs.rm(archivePath, { force: true });
    return;
  }

  try {
    await api.uploadMcpArchiveToCloud(archivePath);
    console.log("Archive uploaded successfully to cloud storage.");
  } catch (error) {
    console.error("Error uploading archive to cloud:", error);
    await fs.rm(archivePath, { force: true });
    throw error;
  }

  await fs.rm(archivePath, { force: true });

  // Output for GitHub Actions
  if (process.env.GITHUB_OUTPUT) {
    await fs.appendFile(process.env.GITHUB_OUTPUT, `mcp_name=${mcpName}\n`);
    await fs.appendFile(process.env.GITHUB_OUTPUT, `version=${version}\n`);
    await fs.appendFile(process.env.GITHUB_OUTPUT, `hash=${hash}\n`);
    await fs.appendFile(process.env.GITHUB_OUTPUT, `download_url=${downloadUrl}\n`);
    console.log("\nGitHub Actions outputs set:");
    console.log(`  mcp_name: ${mcpName}`);
    console.log(`  version: ${version}`);
    console.log(`  hash: ${hash}`);
    console.log(`  download_url: ${downloadUrl}`);
  }
}

export async function uploadMcpArchiveCommand(cwd?: string, mode?: "staging" | "production", dryRun?: boolean) {
  const hasAllOptions = cwd !== undefined && mode !== undefined;
  const isCI = process.env.CI === "true";

  if (hasAllOptions) {
    await uploadMcpArchive(cwd, mode, dryRun ?? false);
  } else if (isCI) {
    console.error("Error: --cwd and --mode are required in CI mode");
    process.exit(1);
  } else {
    const resolved = await promptForOptions({ cwd, mode, dryRun });
    await uploadMcpArchive(resolved.cwd, resolved.mode, resolved.dryRun);
  }
}
