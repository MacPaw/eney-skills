import * as esbuild from "esbuild";
import { resolve, join, basename } from "path";
import { readFile, stat } from "fs/promises";
import { copy, remove } from "fs-extra";
import { execSync } from "child_process";

const defaultOutFolder = "../../../eney-jsx-runtime/extensions";

export async function bundleCommand(outFolder: string = defaultOutFolder, cwd: string = process.cwd()) {
  const extensionFolder = cwd;

  console.log(`Extension folder: ${extensionFolder}`);

  const manifestPath = resolve(extensionFolder, "manifest.json");
  const manifest = await readFile(manifestPath, "utf8");
  const manifestData = JSON.parse(manifest);

  if (!manifestData.tools) {
    console.error(`\nError: No tools found in manifest.json`);
    process.exit(1);
  }

  const extensionFolderName = basename(extensionFolder);

  for (const tool of manifestData.tools) {
    // {extensionFolder}/tools/{tool}/main.tsx
    console.log(`Building extension tool: ${extensionFolder}/${tool.name}`);

    const toolsPath = resolve(extensionFolder, "tools", tool.name);
    const toolsEntry = resolve(toolsPath, "main.tsx");
    const outfile = join(
      outFolder,
      extensionFolderName,
      "tools",
      tool.name,
      "main.js"
    );

    try {
      await stat(toolsEntry);
    } catch {
      console.error(`\nError: Entry point not found at: ${toolsEntry}`);
      process.exit(1);
    }

    try {
      await esbuild.build({
        entryPoints: [toolsEntry],
        bundle: true,
        outfile,
        format: "esm",
        platform: "node",
        target: ["es2022"],
        jsx: "automatic",
        jsxImportSource: "react",
        packages: "external",
        sourcemap: false,
        logLevel: "info",
        loader: {
          ".node": "file",
        },
      });
    } catch (error) {
      console.error("\nBuild failed with errors:");
      console.error(error);
      process.exit(1);
    } finally {
      await esbuild.stop();
    }
  }

  console.log("\nInstalling production dependencies...");
  try {
    execSync("npm i --os=darwin --cpu=arm64 --omit=dev --omit=peer", {
      cwd: extensionFolder,
      stdio: "inherit",
    });
    console.log("Dependencies installed successfully");
  } catch (error) {
    console.error(`\nError installing dependencies: ${error}`);
    process.exit(1);
  }

  const sourceNodeModules = resolve(extensionFolder, "node_modules");
  const targetNodeModules = resolve(
    outFolder,
    extensionFolderName,
    "node_modules"
  );

  try {
    await stat(sourceNodeModules);
    await remove(targetNodeModules);
    await copy(sourceNodeModules, targetNodeModules);
    console.log(
      `${sourceNodeModules} copied successfully to ${targetNodeModules}`
    );
  } catch (error) {
    console.warn(`\nWarning: Could not copy node_modules: ${error}`);
  }

  console.log("\nBundle complete!");

  try {
    execSync("npm i", {
      cwd: extensionFolder,
      stdio: "ignore",
    });
  } catch (error) {
    console.error(`\nError reverting dependencies: ${error}`);
    process.exit(1);
  }
}
