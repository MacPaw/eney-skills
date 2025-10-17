import * as esbuild from "esbuild";
import { resolve, join, basename } from "path";
import { readFile, stat } from "fs/promises";

const defaultOutFolder = "../../../eney-jsx-runtime/extensions";

export async function bundleCommand(outFolder: string = defaultOutFolder) {
  const extensionFolder = process.cwd();

  console.log(`Extension folder: ${extensionFolder}`);

  const manifestPath = resolve(extensionFolder, "manifest.json");
  const manifest = await readFile(manifestPath, "utf8");
  const manifestData = JSON.parse(manifest);

  if (!manifestData.tools) {
    console.error(`\nError: No tools found in manifest.json`);
    process.exit(1);
  }

  for (const tool of manifestData.tools) {
    let toolPath = null;
    let entryPoint = null;

    // {extensionFolder}/tools/{tool}/main.tsx
    console.log(`Building extension tool: ${extensionFolder}/${tool.name}`);
    const toolsPath = resolve(extensionFolder, "tools", tool.name);
    const toolsEntry = resolve(toolsPath, "main.tsx");

    try {
      await stat(toolsEntry);
      toolPath = toolsPath;
      entryPoint = toolsEntry;
    } catch {
      try {
        await stat(toolsEntry);
        toolPath = toolsPath;
        entryPoint = toolsEntry;
      } catch {
        console.error(`\nError: Entry point not found at: ${toolsEntry}`);
        process.exit(1);
      }
    }

    const extensionFolderName = basename(extensionFolder);
    const outfile = join(
      outFolder,
      extensionFolderName,
      "tools",
      tool.name,
      "main.js"
    );

    console.log(`Entry: ${entryPoint}`);
    console.log(`Output: ${outfile}`);

    try {
      await esbuild.build({
        entryPoints: [entryPoint],
        bundle: true,
        outfile,
        format: "esm",
        platform: "node",
        target: ["es2022"],
        jsx: "automatic",
        jsxImportSource: "react",
        external: ["@eney/api", "react", "jsdom", "sharp", "mupdf", "onnxruntime-node"],
        sourcemap: false,
        logLevel: "info",
        loader: {
          ".node": "file",
        },
      });

      console.log(`\nBundle complete! ${extensionFolder}/${tool.name}`);
    } catch (error) {
      console.error("\nBuild failed with errors:");
      console.error(error);
      process.exit(1);
    } finally {
      await esbuild.stop();
    }
  }

  console.log("\nBundle complete!");
}
