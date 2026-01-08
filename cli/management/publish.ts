import { basename, join } from "path";
import semver from "semver";
import fs from "fs/promises";
import * as p from "@clack/prompts";

import { ApiClient } from "../lib/api.ts";

import { getFileDownloadUrl, getFileHash, packExtension } from "./pack.ts";
import { getToolsWithSchemas } from "./extract-schemas.ts";
import { checkVersion } from "./check-version.ts";

type PublishOptions = {
  cwd?: string;
  mode?: "staging" | "production";
  dryRun?: boolean;
};

async function promptForOptions(options: PublishOptions) {
  p.intro("Publish Extension");

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
              message: "Publish mode:",
              options: [
                { value: "staging", label: "Staging" },
                { value: "production", label: "Production" },
              ],
            }),
      dryRun: () =>
        options.dryRun !== undefined
          ? Promise.resolve(options.dryRun)
          : p.confirm({
              message: "Dry run (skip remote publish)?",
              initialValue: false,
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
    dryRun: answers.dryRun as boolean,
  };
}

async function publishExtension(cwd: string, mode: "staging" | "production", dryRun: boolean) {
  const api = new ApiClient(mode);
  const extensionName = basename(cwd);
  const tools = await getToolsWithSchemas(cwd);

  const manifest = JSON.parse(await fs.readFile(join(cwd, "manifest.json"), "utf8"));
  const parsedVersion = semver.coerce(manifest.version).toString();

  await checkVersion(cwd, mode);

  const archivePath = await packExtension(cwd);
  const hash = await getFileHash(archivePath);
  const downloadUrl = await getFileDownloadUrl(archivePath, mode);

  const metadataPayload = {
    extension_id: extensionName,
    tools,
    version: parsedVersion,
  };

  console.dir(metadataPayload, { depth: null });

  const artifactPayload = {
    version: parsedVersion,
    hash,
    downloadUrl,
  };

  console.dir(artifactPayload, { depth: null });

  if (dryRun) {
    console.log("Dry run enabled: skipping remote publish calls.");
    return;
  }

  try {
    const data = await api.publishExtension(metadataPayload);

    console.log("Extension published successfully:", data);
  } catch (error) {
    console.error("Error publishing extension:", error);
    throw error;
  }

  try {
    await api.uploadExtensionArchiveToCloud(archivePath);
  } catch (error) {
    console.error("Error uploading archive to cloud:", error);
    throw error;
  }

  await fs.rm(archivePath, { force: true });

  try {
    const data = await api.publishExtensionVersion(extensionName, {
      version: parsedVersion,
      hash,
      downloadUrl,
    });

    console.log("Extension version published successfully:", data);
  } catch (error) {
    console.error("Error publishing extension:", error);
    throw error;
  }
}

export async function publishExtensionCommand(cwd?: string, mode?: "staging" | "production", dryRun?: boolean) {
  const hasAllOptions = cwd !== undefined && mode !== undefined;
  const isCI = process.env.CI === "true";

  if (hasAllOptions) {
    await publishExtension(cwd, mode, dryRun);
  } else if (isCI) {
    console.error("Error: --cwd, --mode are required in CI mode");
    process.exit(1);
  } else {
    const resolved = await promptForOptions({ cwd, mode, dryRun });
    await publishExtension(resolved.cwd, resolved.mode, resolved.dryRun);
  }
}
