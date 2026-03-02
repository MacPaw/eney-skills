import { resolve, basename, join } from "path";
import { homedir } from "os";
import { watch } from "fs";
import { execSync } from "child_process";
import { cp, readFile, mkdir, writeFile, rm } from "fs/promises";
import color from "picocolors";
import { debounce } from "es-toolkit";
import { extractMcpTools } from "../management/extract-mcp-tools.ts";
import { toolToManifest } from "./tool-to-manifest.ts";

const MCPS_FOLDER = resolve(homedir(), "Library/Application Support/com.macpaw.assistant-macos.client-setapp/MCP");
const TOOLS_FOLDER = resolve(homedir(), ".eney", "tools");

async function copyFolder(src: string, dest: string) {
  await rm(dest, { recursive: true, force: true });

  return cp(src, dest, { recursive: true, force: true });
}

async function buildAndDeploy(mcpDir: string, outFolder: string, isInitialBuild = false): Promise<string> {
  execSync("npx tsc", { cwd: mcpDir, stdio: "inherit" });

  const manifestPath = resolve(mcpDir, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const mcpName = manifest.name || basename(mcpDir);
  const mcpVersion = manifest.version || "1.0.0";

  const distDir = resolve(mcpDir, "dist");
  const targetDir = resolve(outFolder, mcpName);

  await cp(distDir, targetDir, { recursive: true, force: true });
  await cp(manifestPath, join(targetDir, "manifest.json"), { force: true });

  if (isInitialBuild) {
    const nodeModules = resolve(mcpDir, "node_modules");
    const targetNodeModules = join(targetDir, "node_modules");

    await copyFolder(nodeModules, targetNodeModules);
  }

  console.log(color.bold(color.cyan("Extracting tools...")));
  const tools = await extractMcpTools(mcpDir);
  await mkdir(TOOLS_FOLDER, { recursive: true });

  for (const tool of tools) {
    const toolManifest = toolToManifest(tool, mcpName, mcpVersion);
    const toolPath = join(TOOLS_FOLDER, `${tool.name}.json`);
    await writeFile(toolPath, JSON.stringify(toolManifest, null, 2));
    console.log(color.bold(color.cyan(`  → ${toolPath}`)));
  }

  return targetDir;
}

async function devMcp() {
  let isInitialBuild = true;
  const currentFolder = process.cwd();

  console.log(color.bold(color.green(`Watching ${currentFolder} for changes...`)));

  const build = async (filename?: string) => {
    if (filename) {
      console.log(color.bold(color.green(`File ${filename} changed`)));
    }
    console.log(color.bold(color.green("Building...")));
    try {
      const targetDir = await buildAndDeploy(currentFolder, MCPS_FOLDER, isInitialBuild);
      console.log(color.bold(color.green(`Build complete! Deployed to: ${targetDir}`)));
    } catch (error) {
      console.error(color.bold(color.red("Build failed:")));
      console.error(error);
    }
  };

  const debouncedBuild = debounce(build, 1000);

  await build();

  isInitialBuild = false;

  watch(currentFolder, { recursive: true }, async (_event, filename) => {
    if (filename === "package-lock.json" || filename.startsWith("node_modules/") || filename.startsWith("dist/")) {
      return;
    }

    debouncedBuild(filename);
  });
}

export async function devMcpCommand() {
  console.log("Starting MCP dev...");
  await devMcp();
}
