import { join, resolve } from "path";
import semver from "semver";
import { spawn } from "child_process";
import fs from "fs/promises";
import * as p from "@clack/prompts";

import { ApiClient, getMcpFileDownloadUrl } from "../lib/api.ts";
import { extractMcpTools } from "./extract-mcp-tools.ts";
import { checkMcpVersion } from "./check-mcp-version.ts";
import { getFileHash } from "./utils.ts";

type PublishMcpOptions = {
  cwd?: string;
  mode?: "staging" | "production";
  dryRun?: boolean;
};

async function promptForOptions(options: PublishMcpOptions) {
  p.intro("Publish MCP Server");

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
              message: "Publish mode:",
              options: [
                { value: "staging", label: "Staging" },
                { value: "production", label: "Production" },
              ],
            }),
      dryRun: () =>
        options.dryRun !== undefined
          ? Promise.resolve(options.dryRun)
          : p.confirm({
              message: "Dry run (skip remote publish)?",
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

async function publishMcp(cwd: string, mode: "staging" | "production", dryRun: boolean) {
  const api = new ApiClient(mode);
  const mcpDir = resolve(cwd);

  const manifest = JSON.parse(await fs.readFile(join(mcpDir, "manifest.json"), "utf8"));
  const mcpName = manifest.name;
  const parsedVersion = semver.coerce(manifest.version).toString();

  const archiveName = `${mcpName}@v${parsedVersion}.mcpb`;
  const archivePath = join(mcpDir, archiveName);

  await checkMcpVersion(mcpDir, mode);

  await new Promise<void>((resolve, reject) => {
    const npmProcess = spawn("npm", ["run", "pack", "--", archiveName], {
      cwd: mcpDir,
      stdio: "inherit",
      shell: true,
    });

    npmProcess.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`npm run build exited with code ${code}`));
      }
    });

    npmProcess.on("error", (error) => {
      reject(error);
    });
  });

  console.log("\nStep 1/3: Extracting tools from MCP server...");
  const tools = await extractMcpTools(mcpDir);

  // Pack, upload, and calculate hash/URL
  console.log("\nStep 2/3: Uploading to Google Cloud Storage...");
  const finalHash = await getFileHash(archivePath);
  const finalDownloadUrl = getMcpFileDownloadUrl(archiveName, mode);

  console.log(`  Hash: ${finalHash}`);
  console.log(`  Download URL: ${finalDownloadUrl}`);

  if (!dryRun) {
    try {
      await api.uploadMcpArchiveToCloud(archivePath);
      console.log("Archive uploaded successfully to cloud storage.");
    } catch (error) {
      console.error("Error uploading archive to cloud:", error);
      await fs.rm(archivePath, { force: true });
      throw error;
    }
  } else {
    console.log("Dry run: skipping upload to cloud storage.");
  }

  console.log(`\nStep 3/3: Publishing metadata to backend...`);

  const metadataPayload = {
    mode: "local" as const,
    artifact_id: mcpName,
    tools,
    version: parsedVersion,
  };

  console.log("\nMCP metadata:");
  console.dir(metadataPayload, { depth: null });

  const artifactPayload = {
    version: parsedVersion,
    downloadUrl: finalDownloadUrl,
    hash: finalHash,
  };

  console.log("\nArtifact metadata:");
  console.dir(artifactPayload, { depth: null });

  if (dryRun) {
    console.log("Dry run: skipping backend publish calls.");
    await fs.rm(archivePath, { force: true });
    console.log("\nDry run completed successfully!");
    return;
  }

  try {
    const data = await api.publishMcp(metadataPayload);
    console.log("MCP tools published successfully:", data);

    const versionData = await api.publishMcpVersion(mcpName, artifactPayload);
    console.log("MCP version published successfully:", versionData);

    console.log(`\nSuccessfully published ${mcpName}@${parsedVersion}!`);
  } catch (error) {
    console.error("\nError publishing MCP:", error);
    throw error;
  } finally {
    // Clean up temp archive
    await fs.rm(archivePath, { force: true });
  }
}

export async function publishMcpCommand(cwd?: string, mode?: "staging" | "production", dryRun?: boolean) {
  const hasRequiredOptions = cwd !== undefined && mode !== undefined;
  const isCI = process.env.CI === "true";

  if (hasRequiredOptions) {
    await publishMcp(cwd, mode, dryRun ?? false);
  } else if (isCI) {
    console.error("Error: --cwd and --mode are required in CI mode");
    process.exit(1);
  } else {
    const resolved = await promptForOptions({ cwd, mode, dryRun });
    await publishMcp(resolved.cwd, resolved.mode, resolved.dryRun);
  }
}
