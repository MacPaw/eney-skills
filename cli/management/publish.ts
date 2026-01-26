import { basename, join, resolve } from "path";
import semver from "semver";
import fs from "fs/promises";
import * as p from "@clack/prompts";

import { ApiClient } from "../lib/api.ts";
import { getToolsWithSchemas } from "./extract-schemas.ts";
import { checkVersion } from "./check-version.ts";
import { getFileDownloadUrl } from "./pack.ts";

type PublishOptions = {
  cwd?: string;
  mode?: "staging" | "production";
  version?: string;
  hash?: string;
  downloadUrl?: string;
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
      version: () =>
        options.version
          ? Promise.resolve(options.version)
          : p.text({
              message: "Extension version:",
            }),
      hash: () =>
        options.hash
          ? Promise.resolve(options.hash)
          : p.text({
              message: "Archive hash (SHA-256):",
            }),
      downloadUrl: () =>
        options.downloadUrl
          ? Promise.resolve(options.downloadUrl)
          : p.text({
              message: "Archive download URL:",
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
    },
  );

  return {
    cwd: answers.cwd as string,
    mode: answers.mode as "staging" | "production",
    version: answers.version as string,
    hash: answers.hash as string,
    downloadUrl: answers.downloadUrl as string,
    dryRun: answers.dryRun as boolean,
  };
}

async function publishExtension(
  cwd: string,
  mode: "staging" | "production",
  version: string | undefined,
  hash: string | undefined,
  downloadUrl: string | undefined,
  dryRun: boolean,
) {
  const api = new ApiClient(mode);
  const extensionDir = resolve(cwd);
  const extensionName = basename(extensionDir);

  const tools = await getToolsWithSchemas(extensionDir);
  const manifest = JSON.parse(await fs.readFile(join(extensionDir, "manifest.json"), "utf8"));
  const parsedVersion = semver.coerce(manifest.version).toString();

  await checkVersion(extensionDir, mode);

  // If version/hash/downloadUrl not provided, derive from manifest
  const finalVersion = version || parsedVersion;
  const archiveName = `${extensionName}@v${finalVersion}.zip`;
  const finalDownloadUrl = downloadUrl || (await getFileDownloadUrl(archiveName, mode));

  // If hash not provided, we'll need to skip version publishing (only metadata)
  const finalHash = hash || "";

  console.log(`Publishing ${extensionName}@${finalVersion} to backend...`);

  const metadataPayload = {
    extension_id: extensionName,
    tools,
    version: parsedVersion,
  };

  console.log("\nExtension metadata:");
  console.dir(metadataPayload, { depth: null });

  const artifactPayload = {
    version: parsedVersion,
    hash: finalHash,
    downloadUrl: finalDownloadUrl,
  };

  console.log("\nArtifact metadata:");
  console.dir(artifactPayload, { depth: null });

  if (dryRun) {
    console.log("\nDry run enabled: skipping remote publish calls.");
    return;
  }

  try {
    const data = await api.publishExtension(metadataPayload);
    console.log("\nExtension published successfully:", data);
  } catch (error) {
    console.error("\nError publishing extension:", error);
    throw error;
  }

  try {
    const data = await api.publishExtensionVersion(extensionName, artifactPayload);
    console.log("\nExtension version published successfully:", data);
  } catch (error) {
    console.error("\nError publishing extension version:", error);
    throw error;
  }
}

export async function publishExtensionCommand(
  cwd?: string,
  mode?: "staging" | "production",
  version?: string,
  hash?: string,
  downloadUrl?: string,
  dryRun?: boolean,
) {
  const hasAllOptions =
    cwd !== undefined && mode !== undefined && version !== undefined && hash !== undefined && downloadUrl !== undefined;
  const isCI = process.env.CI === "true";

  if (hasAllOptions) {
    await publishExtension(cwd, mode, version, hash, downloadUrl, dryRun);
  } else if (isCI) {
    console.error("Error: --cwd, --mode, --version, --hash, and --download-url are required in CI mode");
    process.exit(1);
  } else {
    const resolved = await promptForOptions({ cwd, mode, version, hash, downloadUrl, dryRun });
    await publishExtension(
      resolved.cwd,
      resolved.mode,
      resolved.version,
      resolved.hash,
      resolved.downloadUrl,
      resolved.dryRun,
    );
  }
}
