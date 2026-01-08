import * as esbuild from "esbuild";
import { resolve, join, basename } from "path";
import { readFile, stat } from "fs/promises";
import { copy, remove } from "fs-extra";
import { execSync } from "child_process";
import * as p from "@clack/prompts";

export async function bundle(cwd: string, outFolder: string) {
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
    const outfile = join(outFolder, extensionFolderName, "tools", tool.name, "main.js");

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
    execSync("npm i --os=darwin --cpu=arm64 --omit=dev --no-fund --no-audit", {
      cwd: extensionFolder,
      stdio: "inherit",
    });
    console.log("Dependencies installed successfully");
  } catch (error) {
    console.error(`\nError installing dependencies: ${error}`);
    process.exit(1);
  }

  const sourceNodeModules = resolve(extensionFolder, "node_modules");
  const targetNodeModules = resolve(outFolder, extensionFolderName, "node_modules");

  try {
    await stat(sourceNodeModules);
    await remove(targetNodeModules);
    await copy(sourceNodeModules, targetNodeModules);
    console.log(`${sourceNodeModules} copied successfully to ${targetNodeModules}`);
  } catch (error) {
    console.warn(`\nWarning: Could not copy node_modules: ${error}`);
  }

  await copy(manifestPath, resolve(outFolder, extensionFolderName, "manifest.json"));

  try {
    execSync("npm i", {
      cwd: extensionFolder,
      stdio: "ignore",
    });
  } catch (error) {
    console.error(`\nError reverting dependencies: ${error}`);
    process.exit(1);
  }

  const bundledPath = resolve(outFolder, extensionFolderName);
  return bundledPath;
}

type BundleOptions = {
  output?: string;
  cwd?: string;
};

async function promptForOptions(options: BundleOptions) {
  p.intro("Bundle Extension");

  const answers = await p.group(
    {
      cwd: () =>
        options.cwd
          ? Promise.resolve(options.cwd)
          : p.text({
              message: "Extension directory:",
              initialValue: process.cwd(),
              validate: (value) => {
                if (!value) {
                  return "Extension directory is required";
                }
              },
            }),
      output: () =>
        options.output
          ? Promise.resolve(options.output)
          : p.text({
              message: "Output folder:",
              initialValue: "./dist",
              validate: (value) => {
                if (!value) {
                  return "Output folder is required";
                }
              },
            }),
    },
    {
      onCancel: () => {
        p.cancel("Operation cancelled.");
        process.exit(0);
      },
    }
  );

  return answers;
}

export async function bundleCommand(output?: string, cwd?: string) {
  const hasAllOptions = output !== undefined && cwd !== undefined;
  const isCI = process.env.CI === "true";

  let resolvedCwd: string = cwd;
  let resolvedOutput: string = output;

  if (!hasAllOptions && isCI) {
    console.error("Error: --cwd and --output are required in CI mode");
    process.exit(1);
  } else if (!hasAllOptions) {
    const answers = await promptForOptions({ output, cwd });
    resolvedCwd = answers.cwd;
    resolvedOutput = answers.output;
  }

  const bundledFolder = await bundle(resolvedCwd, resolvedOutput);
  console.log(`Bundle complete! Output folder: ${bundledFolder}`);
}
