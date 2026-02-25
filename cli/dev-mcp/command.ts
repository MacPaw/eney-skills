import { resolve, basename, join } from "path";
import { homedir } from "os";
import { watch } from "fs";
import { execSync } from "child_process";
import { cp, readFile } from "fs/promises";
import color from "picocolors";
import { debounce } from "es-toolkit";

const MCPS_FOLDER = resolve(
  homedir(),
  "Library/Application Support/com.macpaw.assistant-macos.client-setapp/MCP",
);

async function buildAndDeploy(mcpDir: string, outFolder: string) {
  execSync("npx tsc", { cwd: mcpDir, stdio: "inherit" });

  const distDir = resolve(mcpDir, "dist");
  const manifestPath = resolve(mcpDir, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const mcpName = manifest.name || basename(mcpDir);
  const targetDir = resolve(outFolder, mcpName);

  await cp(distDir, targetDir, { recursive: true, force: true });
  await cp(manifestPath, join(targetDir, "manifest.json"), { force: true });

  const nodeModules = resolve(mcpDir, "node_modules");
  await cp(nodeModules, join(targetDir, "node_modules"), { recursive: true, force: true });

  return targetDir;
}

async function devMcp() {
  const currentFolder = process.cwd();

  console.log(color.bold(color.green(`Watching ${currentFolder} for changes...`)));

  const build = async (filename?: string) => {
    if (filename) {
      console.log(color.bold(color.green(`File ${filename} changed`)));
    }
    console.log(color.bold(color.green("Building...")));
    try {
      const targetDir = await buildAndDeploy(currentFolder, MCPS_FOLDER);
      console.log(color.bold(color.green(`Build complete! Deployed to: ${targetDir}`)));
    } catch (error) {
      console.error(color.bold(color.red("Build failed:")));
      console.error(error);
    }
  };

  const debouncedBuild = debounce(build, 1000);

  await build();

  watch(currentFolder, { recursive: true }, async (_event, filename) => {
    if (
      filename === "package-lock.json" ||
      filename.startsWith("node_modules/") ||
      filename.startsWith("dist/")
    ) {
      return;
    }

    debouncedBuild(filename);
  });
}

export async function devMcpCommand() {
  console.log("Starting MCP dev...");
  await devMcp();
}
