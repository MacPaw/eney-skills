import { join, resolve } from "path";
import semver from "semver";
import fs from "fs/promises";
import os from "os";
import { styleText } from "node:util";
import { spawnSync } from "child_process";

import { ApiClient, getMcpFileDownloadUrl } from "../lib/api.ts";
import { extractMcpTools } from "./extract-mcp-tools.ts";
import { getFileHash } from "./utils.ts";

async function unpackMcpArchive(archivePath: string): Promise<string> {
  const tmpDir = await fs.mkdtemp(join(os.tmpdir(), "mcpb-"));
  const result = spawnSync("npx", ["--yes", "@anthropic-ai/mcpb", "unpack", archivePath, tmpDir], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`Failed to unpack .mcpb archive!\n${result.stderr}`);
  }
  return tmpDir;
}

export async function publishMcpMetadata(mode: "staging" | "production", archivePath: string) {
  const api = new ApiClient(mode);
  const resolvedArchivePath = resolve(archivePath);

  let tmpDir = "";

  try {
    console.log("\nStep 1/3: Unpacking .mcpb archive...");
    tmpDir = await unpackMcpArchive(resolvedArchivePath);

    const manifestPath = join(tmpDir, "manifest.json");

    // check for path traversal
    if (manifestPath.indexOf(tmpDir) !== 0) {
      throw new Error(`Invalid manifest path: ${manifestPath}`);
    }

    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    const mcpName = manifest.name;
    const parsedVersion = semver.coerce(manifest.version)?.toString();
    const archiveName = `${mcpName}@v${parsedVersion}.mcpb`;

    if (!parsedVersion) {
      throw new Error(`Invalid version in manifest: ${manifest.version}`);
    }

    console.log("\nStep 2/3: Extracting tools from MCP server...");

    const tools = await extractMcpTools(tmpDir);

    console.log("\nStep 3/3: Publishing metadata to backend...");
    const finalHash = await getFileHash(resolvedArchivePath);
    const finalDownloadUrl = getMcpFileDownloadUrl(archiveName, mode);

    const metadataPayload = {
      artifactId: mcpName,
      tools,
      version: parsedVersion,
      downloadUrl: finalDownloadUrl,
      hash: finalHash,
    };

    console.log("\nMCP metadata:");
    console.log(JSON.stringify(metadataPayload, null, 2));

    try {
      await api.publishMcp(metadataPayload);
      console.log(`\nSuccessfully published ${mcpName}@${parsedVersion}!`);
    } catch (error) {
      throw new Error(`Failed to publish MCP metadata!\n${error}`);
    }
  } catch (error) {
    console.error(styleText("red", String(error)));
    process.exit(1);
  } finally {
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  }
}
