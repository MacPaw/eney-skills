import { basename, join } from "path";
import fs from "fs/promises";
import semver from "semver";
import * as p from "@clack/prompts";

import { ApiClient } from "../lib/api.ts";

export async function checkVersion(cwd: string, mode: "staging" | "production" = "staging") {
  const api = new ApiClient(mode);
  const extensionName = basename(cwd);

  const manifest = JSON.parse(await fs.readFile(join(cwd, "manifest.json"), "utf8"));
  const currentVersion = semver.coerce(manifest.version);

  try {
    const versions = await api.getExtensionVersions(extensionName);

    if (versions.length === 0) {
      console.log(`Extension ${extensionName} artifact versions not found, ready to publish`);
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
  } catch (error) {
    console.error(`\nError checking extension version!\n${error.message}`);
    process.exit(1);
  }
}

type CheckVersionOptions = {
  cwd?: string;
  mode?: "staging" | "production";
};

async function promptForOptions(options: CheckVersionOptions) {
  p.intro("Check Version");

  const answers = await p.group(
    {
      cwd: () =>
        options.cwd
          ? Promise.resolve(options.cwd)
          : p.text({
              message: "Extension directory:",
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

export async function checkVersionCommand(cwd?: string, mode?: "staging" | "production") {
  const hasAllOptions = cwd !== undefined && mode !== undefined;
  const isCI = process.env.CI === "true";

  if (hasAllOptions) {
    await checkVersion(cwd, mode);
  } else if (isCI) {
    console.error("Error: --cwd and --mode are required in CI mode");
    process.exit(1);
  } else {
    const resolved = await promptForOptions({ cwd, mode });
    await checkVersion(resolved.cwd, resolved.mode);
  }
}
