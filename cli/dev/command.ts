import { resolve } from "path";
import { homedir } from "os";
import { watch } from "fs";
import color from "picocolors";
import { debounce } from "es-toolkit";
import { bundle } from "../bundle/command.ts";

const EXTENSIONS_FOLDER = resolve(
  homedir(),
  "Library/Application Support/com.macpaw.assistant-macos.client-setapp/JSX/extensions",
);

async function dev() {
  const currentFolder = process.cwd();

  console.log(`${color.bold(color.green(`Watching ${currentFolder} for changes...`))}`);

  const build = async (_event: unknown, filename: string) => {
    console.log(`${color.bold(color.green(`File ${filename} changed`))}`);
    console.log(`${color.bold(color.green(`Bundling...`))}`);
    await bundle(currentFolder, EXTENSIONS_FOLDER);
    console.log(`${color.bold(color.green(`Bundle complete! Output folder: ${EXTENSIONS_FOLDER}`))}`);
  };

  const debouncedBuild = debounce(build, 1000);

  watch(currentFolder, { recursive: true }, async (event, filename) => {
    if (filename === "package-lock.json" || filename.startsWith("node_modules/")) {
      return;
    }

    await debouncedBuild(event, filename);
  });
}

export async function devCommand() {
  console.log(`Starting dev...`);
  await dev();
}
