import { join } from "path";
import fs from "fs/promises";
import semver from "semver";
import * as p from "@clack/prompts";

import { ApiClient } from "../lib/api.ts";

export async function checkMcpVersion(cwd: string, mode: "staging" | "production" = "staging") {
  const api = new ApiClient(mode);

  const manifest = JSON.parse(await fs.readFile(join(cwd, "manifest.json"), "utf8"));
  const mcpName = manifest.name;
  const currentVersion = semver.coerce(manifest.version);

  if (!mcpName) {
    throw new Error(`Missing "name" field in manifest.json`);
  }

  try {
    const versions = await api.getMcpVersions(mcpName);

    if (versions.length === 0) {
      console.log(`MCP ${mcpName} artifact versions not found, ready to publish`);
      return;
    }

    const versionList = versions.map((version) => semver.coerce(version.version)).sort((a, b) => semver.compare(b, a));
    const latestVersion = semver.coerce(versionList[0]);

    if (versionList.some((version) => semver.eq(version, currentVersion))) {
      throw new Error(`Version ${currentVersion} already exists! Please update the version in the manifest.json file.`);
    }

    if (!semver.valid(currentVersion)) {
      throw new Error(
        `Version ${currentVersion} is not a valid semver version! Please update the version in the manifest.json file.`
      );
    }

    if (semver.lt(currentVersion, latestVersion)) {
      throw new Error(
        `Version ${currentVersion} is less than the latest version ${versionList[0]}! Please update the version in the manifest.json file.`
      );
    }

    console.log(`Version ${currentVersion} does not exist, all good!`);
  } catch (error: any) {
    console.error(`\nError checking MCP version!\n${error.message}`);
    process.exit(1);
  }
}

type CheckMcpVersionOptions = {
  cwd?: string;
  mode?: "staging" | "production";
};

async function promptForOptions(options: CheckMcpVersionOptions) {
  p.intro("Check MCP Version");

  const answers = await p.group(
    {
      cwd: () =>
        options.cwd
          ? Promise.resolve(options.cwd)
          : p.text({
              message: "MCP server directory:",
              initialValue: process.cwd(),
            }),
      mode: () =>
        options.mode
          ? Promise.resolve(options.mode)
          : p.select({
              message: "Mode:",
              options: [
                { value: "staging", label: "Staging" },
                { value: "production", label: "Production" },
              ],
            }),
    },
    {
      onCancel: () => {
        p.cancel("Operation cancelled.");
        process.exit(0);
      },
    }
  );

  return {
    cwd: answers.cwd as string,
    mode: answers.mode as "staging" | "production",
  };
}

export async function checkMcpVersionCommand(cwd?: string, mode?: "staging" | "production") {
  const hasAllOptions = cwd !== undefined && mode !== undefined;
  const isCI = process.env.CI === "true";

  if (hasAllOptions) {
    await checkMcpVersion(cwd, mode);
  } else if (isCI) {
    console.error("Error: --cwd and --mode are required in CI mode");
    process.exit(1);
  } else {
    const resolved = await promptForOptions({ cwd, mode });
    await checkMcpVersion(resolved.cwd, resolved.mode);
  }
}
