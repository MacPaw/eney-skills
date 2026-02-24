import { join, resolve } from "path";
import semver from "semver";
import fs from "fs/promises";
import os from "os";
import { spawnSync } from "child_process";
import * as p from "@clack/prompts";

import { ApiClient, getMcpFileDownloadUrl } from "../lib/api.ts";
import { extractMcpTools } from "./extract-mcp-tools.ts";
import { checkMcpVersion } from "./check-mcp-version.ts";
import { getFileHash } from "./utils.ts";

type PublishMcpMetadataOptions = {
  mode?: "staging" | "production";
  archivePath?: string;
  toolsJsonPath?: string;
};

async function promptForOptions(options: PublishMcpMetadataOptions) {
  p.intro("Publish MCP Metadata");

  const answers = await p.group(
    {
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
              message: "Path to .mcpb archive:",
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
    mode: answers.mode as "staging" | "production",
    archivePath: answers.archivePath as string,
  };
}

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
  mode?: "staging" | "production",
  archivePath?: string,
  toolsJson?: string,
) {
  const hasRequiredOptions = mode !== undefined && archivePath !== undefined;
  const isCI = process.env.CI === "true";

  if (hasRequiredOptions) {
    await publishMcpMetadata(mode, archivePath, toolsJson);
  } else if (isCI) {
    console.error("Error: --mode and --archive-path are required in CI mode");
    process.exit(1);
  } else {
    const resolved = await promptForOptions({ mode, archivePath });
    await publishMcpMetadata(resolved.mode, resolved.archivePath, toolsJson);
  }
}
