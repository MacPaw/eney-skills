import { join, resolve } from "path";
import semver from "semver";
import fs from "fs/promises";
import os from "os";
import { spawnSync } from "child_process";

import { ApiClient, getMcpFileDownloadUrl } from "../lib/api.ts";
import { extractMcpTools } from "./extract-mcp-tools.ts";
import { checkMcpVersion } from "./check-mcp-version.ts";
import { getFileHash } from "./utils.ts";

async function unpackMcpArchive(archivePath: string): Promise<string> {
  const tmpDir = await fs.mkdtemp(join(os.tmpdir(), "mcpb-"));
  const result = spawnSync("npx", ["--yes", "@anthropic-ai/mcpb", "unpack", archivePath, tmpDir], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`Failed to unpack .mcpb archive: ${result.stderr}`);
  }
  return tmpDir;
}

async function publishMcpMetadata(mode: "staging" | "production", archivePath: string, toolsJsonPath?: string) {
  const api = new ApiClient(mode);
  const resolvedArchivePath = resolve(archivePath);

  console.log("\nStep 1/3: Unpacking .mcpb archive...");
  const tmpDir = await unpackMcpArchive(resolvedArchivePath);

  try {
    const manifest = JSON.parse(await fs.readFile(join(tmpDir, "manifest.json"), "utf8"));
    const mcpName = manifest.name;
    const parsedVersion = semver.coerce(manifest.version).toString();
    const archiveName = `${mcpName}@v${parsedVersion}.mcpb`;

    await checkMcpVersion(tmpDir, mode);

    console.log("\nStep 2/3: Extracting tools from MCP server...");
    let tools;
    if (toolsJsonPath) {
      console.log(`Using pre-extracted tools from ${toolsJsonPath}`);
      tools = JSON.parse(await fs.readFile(resolve(toolsJsonPath), "utf8"));
    } else {
      tools = await extractMcpTools(tmpDir);
    }

    console.log("\nStep 3/3: Publishing metadata to backend...");
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
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

export async function publishMcpMetadataCommand(
  mode: "staging" | "production",
  archivePath: string,
  toolsJson?: string,
) {
  await publishMcpMetadata(mode, archivePath, toolsJson);
}
