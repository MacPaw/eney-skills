import { join, resolve } from "path";
import fs from "fs/promises";
import { spawn, spawnSync } from "child_process";
import { tmpdir } from "os";
import { existsSync } from "fs";
import * as p from "@clack/prompts";

export async function packMcp(cwd: string, out?: string): Promise<string> {
  const mcpDir = resolve(cwd);
  const manifestPath = join(mcpDir, "manifest.json");

  try {
    await fs.stat(mcpDir);
  } catch {
    throw new Error(`Directory not found: ${mcpDir}`);
  }

  let manifestVersion: string | undefined;
  let manifestName: string | undefined;

  try {
    const manifestRaw = await fs.readFile(manifestPath, "utf8");
    const manifest = JSON.parse(manifestRaw);
    manifestVersion = manifest.version;
    manifestName = manifest.name;
  } catch (error: any) {
    throw new Error(`Unable to read manifest at ${manifestPath}: ${error.message}`);
  }

  if (!manifestVersion) {
    throw new Error(`Missing "version" field in manifest at ${manifestPath}`);
  }

  if (!manifestName) {
    throw new Error(`Missing "name" field in manifest at ${manifestPath}`);
  }

  let outputDir = tmpdir();

  if (out) {
    outputDir = resolve(out);

    if (!existsSync(outputDir)) {
      await fs.mkdir(outputDir, { recursive: true });
    }
  }

  const archiveName = `${manifestName}@v${manifestVersion}.mcpb`;
  const archiveResultPath = join(outputDir, archiveName);

  // Check if package.json has a pack script
  const packageJsonPath = join(mcpDir, "package.json");
  try {
    const packageJsonRaw = await fs.readFile(packageJsonPath, "utf8");
    const packageJson = JSON.parse(packageJsonRaw);

    if (!packageJson.scripts?.pack) {
      throw new Error(`Missing "pack" script in package.json at ${packageJsonPath}`);
    }
  } catch (error: any) {
    throw new Error(`Unable to read package.json at ${packageJsonPath}: ${error.message}`);
  }

  // Remove old archive if exists
  await fs.rm(archiveResultPath, { force: true }).catch(() => undefined);

  console.log(`Creating MCP archive ${archiveName} in ${outputDir}...`);

  // Execute npm run pack
  await new Promise<void>((resolve, reject) => {
    const npmProcess = spawn("npm", ["run", "pack", "--", archiveName], {
      cwd: mcpDir,
      stdio: "inherit",
      shell: true,
    });

    npmProcess.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`npm run pack exited with code ${code}`));
      }
    });

    npmProcess.on("error", (error) => {
      reject(error);
    });
  });

  // Find the created .mcpb file in the MCP directory
  const expectedArchivePath = join(mcpDir, archiveName);

  try {
    await fs.stat(expectedArchivePath);
  } catch {
    throw new Error(`Archive not found at ${expectedArchivePath} after running pack command`);
  }

  // Move archive to output directory if different from MCP directory
  if (outputDir !== mcpDir) {
    await fs.rename(expectedArchivePath, archiveResultPath);
  }

  console.log(`Archive created at ${archiveResultPath}`);

  return archiveResultPath;
}

export async function getFileHash(filePath: string): Promise<string> {
  const result = spawnSync("shasum", ["-a", "256", filePath], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`Failed to calculate sha256 hash: ${result.stderr}`);
  }
  // shasum outputs "<hash>  <filename>"
  const hash = result.stdout.split(" ")[0].trim();
  return hash;
}

type PackOptions = {
  cwd?: string;
  output?: string;
};

async function promptForOptions(options: PackOptions) {
  p.intro("Pack MCP Server");

  const answers = await p.group(
    {
      cwd: () =>
        options.cwd
          ? Promise.resolve(options.cwd)
          : p.text({
              message: "MCP server directory:",
              initialValue: process.cwd(),
            }),
      output: () =>
        options.output
          ? Promise.resolve(options.output)
          : p.text({
              message: "Output directory (leave empty for temp):",
              placeholder: "Leave empty for temp directory",
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
    cwd: answers.cwd as string,
    output: (answers.output as string) || undefined,
  };
}

export async function packMcpCommand(cwd?: string, output?: string) {
  const isCI = process.env.CI === "true";

  if (cwd !== undefined) {
    await packMcp(cwd, output);
  } else if (isCI) {
    console.error("Error: --cwd is required in CI mode");
    process.exit(1);
  } else {
    const resolved = await promptForOptions({ cwd, output });
    await packMcp(resolved.cwd, resolved.output);
  }
}
