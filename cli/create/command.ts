import { join } from "node:path";
import { readdir, mkdir, readFile, writeFile, rename, rm, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { exec } from "node:child_process";
import { copy } from "fs-extra";
import handlebars from "handlebars";

const templateFolder = fileURLToPath(new URL("./template", import.meta.url));

type WalkEntry = {
  path: string;
  isDirectory: boolean;
};

async function* walkDirectory(directory: string): AsyncGenerator<WalkEntry> {
  const dirents = await readdir(directory, { withFileTypes: true });

  for (const dirent of dirents) {
    const fullPath = join(directory, dirent.name);

    if (dirent.isDirectory()) {
      yield { path: fullPath, isDirectory: true };
      yield* walkDirectory(fullPath);
    } else {
      yield { path: fullPath, isDirectory: false };
    }
  }
}

function toPascalCase(str: string): string {
  return str
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

type McpDetails = {
  mcpId: string;
  mcpTitle: string;
  toolName: string;
  toolDescription: string;
  toolTitle: string;
};

type CreateCommandOptions = {
  output: string;
} & McpDetails;

async function folderExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export async function createCommand(options: CreateCommandOptions) {
  const { output: outputDirectory, mcpId, mcpTitle, toolName, toolDescription, toolTitle } = options;

  const directoriesToRename: { oldPath: string; newPath: string }[] = [];

  console.log("Creating MCP server...");

  const localOutputFolder = join(outputDirectory, mcpId);

  if (await folderExists(localOutputFolder)) {
    console.log(`MCP server at "${localOutputFolder}" already exists, overwriting.`);
    await rm(localOutputFolder, { recursive: true, force: true });
  }

  const fullDetails = {
    mcpId,
    mcpTitle,
    toolName,
    toolDescription,
    toolTitle,
    toolNamePascal: toPascalCase(toolName),
  };

  await mkdir(localOutputFolder, { recursive: true });

  await copy(templateFolder, localOutputFolder, { overwrite: true, errorOnExist: false });

  for await (const entry of walkDirectory(localOutputFolder)) {
    if (entry.isDirectory) {
      if (!entry.path.includes("{{") && !entry.path.includes("}}")) {
        continue;
      }

      const updatedName = handlebars.compile(entry.path)(fullDetails);
      if (updatedName !== entry.path) {
        directoriesToRename.push({ oldPath: entry.path, newPath: updatedName });
      }
    } else {
      const content = await readFile(entry.path, "utf8");
      const updatedContent = handlebars.compile(content)(fullDetails);
      await writeFile(entry.path, updatedContent, "utf8");

      let currentPath = entry.path;

      if (currentPath.endsWith(".hbs")) {
        const renamedPath = currentPath.replace(/\.hbs$/, "");
        await rename(currentPath, renamedPath);
        currentPath = renamedPath;
      }

      if (currentPath.includes("{{") && currentPath.includes("}}")) {
        const updatedPath = handlebars.compile(currentPath)(fullDetails);
        if (updatedPath !== currentPath) {
          await rename(currentPath, updatedPath);
        }
      }
    }
  }

  const directoriesByDepth = directoriesToRename.sort((a, b) => b.oldPath.length - a.oldPath.length);

  for (const directory of directoriesByDepth) {
    await rename(directory.oldPath, directory.newPath);
  }

  console.log("MCP server created. Installing dependencies...");

  await new Promise<void>((resolve, reject) => {
    exec("npm install && npm install @eney/api@latest", { cwd: localOutputFolder }, (error) => {
      if (error) {
        return reject(error);
      }
      resolve();
    });
  });

  console.log(`MCP server created at ${localOutputFolder}`);
}
