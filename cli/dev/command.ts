import { resolve, basename, join } from "path";
import { homedir } from "os";
import { watch } from "fs";
import { execSync } from "child_process";
import { cp, readFile, mkdir, writeFile, rm } from "fs/promises";
import { styleText } from "node:util";
import { debounce } from "es-toolkit";
import { extractMcpTools } from "../management/extract-mcp-tools.ts";
import { getOpenLink, toolToManifest } from "./tool-to-manifest.ts";

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

  console.log(styleText(["cyan", "bold"], "Extracting tools..."));
  const tools = await extractMcpTools(mcpDir);
  await mkdir(TOOLS_FOLDER, { recursive: true });

  for (const tool of tools) {
    const toolManifest = toolToManifest(tool, mcpName, mcpVersion);
    const toolPath = join(TOOLS_FOLDER, `${tool.name}.json`);
    await writeFile(toolPath, JSON.stringify(toolManifest, null, 2));
    console.log(styleText(["cyan", "bold"], `  → ${toolPath}`));
  }

  for (const tool of tools) {
    const openLink = await getOpenLink(tool.name);
    console.log(styleText(["magenta", "bold"], `Run ${tool.name}: ${openLink}`));
  }

  return targetDir;
}

export async function devMcp() {
  let isInitialBuild = true;
  const currentFolder = process.cwd();

  console.log(styleText(["green", "bold"], `Watching ${currentFolder} for changes...`));

  const build = async (filename?: string) => {
    if (filename) {
      console.log(styleText(["green", "bold"], `File ${filename} changed`));
    }
    console.log(styleText(["green", "bold"], "Building..."));
    try {
      const targetDir = await buildAndDeploy(currentFolder, MCPS_FOLDER, isInitialBuild);
      console.log(styleText(["green", "bold"], `Build complete! Deployed to: ${targetDir}`));
    } catch (error) {
      console.error(styleText(["red", "bold"], "Build failed:"));
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
