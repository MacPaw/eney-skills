import { join, resolve } from "path";
import semver from "semver";
import fs from "fs/promises";
import * as p from "@clack/prompts";

import { ApiClient, getMcpFileDownloadUrl } from "../lib/api.ts";
import { extractMcpTools } from "./extract-mcp-tools.ts";
import { checkMcpVersion } from "./check-mcp-version.ts";
import { getFileHash } from "./utils.ts";

type PublishMcpMetadataOptions = {
  cwd?: string;
  mode?: "staging" | "production";
  archivePath?: string;
};

async function promptForOptions(options: PublishMcpMetadataOptions) {
  p.intro("Publish MCP Metadata");

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
      archivePath: () =>
        options.archivePath
          ? Promise.resolve(options.archivePath)
          : p.text({
              message: "Path to .mcpb archive (for hash computation):",
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
    archivePath: answers.archivePath as string,
  };
}

async function publishMcpMetadata(cwd: string, mode: "staging" | "production", archivePath: string) {
  const api = new ApiClient(mode);
  const mcpDir = resolve(cwd);
  const resolvedArchivePath = resolve(archivePath);

  const manifest = JSON.parse(await fs.readFile(join(mcpDir, "manifest.json"), "utf8"));
  const mcpName = manifest.name;
  const parsedVersion = semver.coerce(manifest.version).toString();
  const archiveName = `${mcpName}@v${parsedVersion}.mcpb`;

  await checkMcpVersion(mcpDir, mode);

  console.log("\nStep 1/2: Extracting tools from MCP server...");
  const tools = await extractMcpTools(mcpDir);

  console.log("\nStep 2/2: Publishing metadata to backend...");
  const finalHash = await getFileHash(resolvedArchivePath);
  const finalDownloadUrl = getMcpFileDownloadUrl(archiveName, mode);

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

  try {
    const data = await api.publishMcp(metadataPayload);
    console.log("MCP tools published successfully:", data);

    const versionData = await api.publishMcpVersion(mcpName, artifactPayload);
    console.log("MCP version published successfully:", versionData);

    console.log(`\nSuccessfully published ${mcpName}@${parsedVersion}!`);
  } catch (error) {
    console.error("\nError publishing MCP:", error);
    throw error;
  }
}

export async function publishMcpMetadataCommand(cwd?: string, mode?: "staging" | "production", archivePath?: string) {
  const hasRequiredOptions = cwd !== undefined && mode !== undefined && archivePath !== undefined;
  const isCI = process.env.CI === "true";

  if (hasRequiredOptions) {
    await publishMcpMetadata(cwd, mode, archivePath);
  } else if (isCI) {
    console.error("Error: --cwd, --mode, and --archive-path are required in CI mode");
    process.exit(1);
  } else {
    const resolved = await promptForOptions({ cwd, mode, archivePath });
    await publishMcpMetadata(resolved.cwd, resolved.mode, resolved.archivePath);
  }
}
