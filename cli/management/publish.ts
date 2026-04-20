import { join, resolve } from "path";
import fs from "fs/promises";
import { spawnSync } from "child_process";
import { styleText } from "node:util";

import { uploadMcpArchive } from "./upload-mcp-archive.ts";
import { publishMcpMetadata } from "./publish-mcp-metadata.ts";

function run(command: string, args: string[], cwd: string) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit", shell: false });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
}

export async function publish(mode: "staging" | "production") {
  const cwd = process.cwd();
  const manifestPath = resolve(cwd, "manifest.json");

  let manifest: { name: string; version: string };
  try {
    manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  } catch {
    console.error(
      styleText(
        "red",
        `No manifest.json found in ${cwd}. Run this from an extension directory.`,
      ),
    );
    process.exit(1);
  }

  const archiveName = `${manifest.name}@v${manifest.version}.mcpb`;
  const archivePath = join(cwd, archiveName);

  console.log(`\nPacking ${archiveName}...`);
  run("npm", ["ci", "--os=darwin", "--cpu=arm64"], cwd);
  run("npm", ["run", "build"], cwd);
  run("npx", ["--yes", "@anthropic-ai/mcpb", "pack", "dist", archiveName], cwd);

  await uploadMcpArchive(archivePath, mode);
  await publishMcpMetadata(mode, archivePath);
}
