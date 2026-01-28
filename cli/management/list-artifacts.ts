import * as p from "@clack/prompts";
import color from "picocolors";
import { ApiClient } from "../lib/api.ts";
import { fetchAnalytics, formatAge, formatSize } from "./utils.ts";

type ListArtifactsOptions = {
  mode?: "staging" | "production";
  prefix?: string;
};

async function promptForOptions(options: ListArtifactsOptions) {
  p.intro("List Artifacts");

  const answers = await p.group(
    {
      mode: () =>
        options.mode
          ? Promise.resolve(options.mode)
          : p.select({
              message: "Select environment:",
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
    },
  );

  return {
    mode: answers.mode as "staging" | "production",
    prefix: options.prefix,
  };
}

async function listArtifacts(mode: "staging" | "production", prefix?: string) {
  const api = new ApiClient(mode);

  console.log(`\nFetching artifacts and analytics from ${mode}...`);

  const [artifacts, downloadCounts] = await Promise.all([
    api.listExtensionArchivesInCloud(prefix),
    fetchAnalytics(mode),
  ]);

  if (artifacts.length === 0) {
    console.log("No artifacts found.");
    return;
  }

  console.log(`\nFound ${artifacts.length} artifact(s):\n`);

  const artifactsWithDownloads = artifacts.map((artifact) => {
    const fileName = artifact.name.replace("extensions/", "");
    return {
      ...artifact,
      downloads: downloadCounts.get(fileName) ?? 0,
    };
  });

  const sortedArtifacts = artifactsWithDownloads.sort((a, b) => {
    const dateA = a.created?.getTime() ?? 0;
    const dateB = b.created?.getTime() ?? 0;
    return dateB - dateA;
  });

  for (const artifact of sortedArtifacts) {
    const name = artifact.name.replace("extensions/", "");
    const size = formatSize(artifact.size);
    const age = formatAge(artifact.created);
    const downloads = artifact.downloads.toLocaleString();

    console.log(`  ${color.bold(name)}`);
    console.log(`    Uploaded: ${age}  |  Downloads in last 30 days: ${color.magenta(downloads)} | Size: ${color.yellow(size)}`);
  }

  console.log();
}

export async function listArtifactsCommand(mode?: "staging" | "production", prefix?: string) {
  const hasAllOptions = mode !== undefined;
  const isCI = process.env.CI === "true";

  if (hasAllOptions) {
    await listArtifacts(mode, prefix);
  } else if (isCI) {
    console.error("Error: --mode is required in CI mode");
    process.exit(1);
  } else {
    const resolved = await promptForOptions({ mode, prefix });
    await listArtifacts(resolved.mode, resolved.prefix);
  }
}
