import * as p from "@clack/prompts";
import color from "picocolors";
import { ApiClient } from "../lib/api.ts";
import { fetchAnalytics, formatAge, formatSize } from "./utils.ts";

type DeleteArtifactsOptions = {
  mode?: "staging" | "production";
  prefix?: string;
};

async function promptForOptions(options: DeleteArtifactsOptions) {
  p.intro("Delete Artifacts");

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

async function deleteArtifacts(mode: "staging" | "production", prefix?: string) {
  const api = new ApiClient(mode);

  const spinner = p.spinner();
  spinner.start("Fetching artifacts and analytics...");

  const [artifacts, downloadCounts] = await Promise.all([
    api.listExtensionArchivesInCloud(prefix),
    fetchAnalytics(mode),
  ]);

  spinner.stop("Data fetched");

  if (artifacts.length === 0) {
    p.log.info("No artifacts found.");
    return;
  }

  const artifactsWithDownloads = artifacts.map((artifact) => {
    const fileName = artifact.name.replace("extensions/", "");
    return {
      ...artifact,
      downloads: downloadCounts.get(fileName) ?? 0,
    };
  });

  const sortedArtifacts = artifactsWithDownloads.sort((a, b) => a.downloads - b.downloads);

  const selected = await p.autocompleteMultiselect({
    message: `Select artifacts to delete (${mode}):`,
    options: sortedArtifacts.map((artifact) => {
      const name = artifact.name.replace("extensions/", "");
      const size = formatSize(artifact.size);
      const age = formatAge(artifact.created);
      const downloads = artifact.downloads.toLocaleString();
      return {
        value: artifact.name,
        label: `${color.bold(color.blue(name))} ${color.dim("-")} ${color.yellow(size)} ${color.dim("|")} ${color.cyan(age)} ${color.dim("|")} ${color.magenta(downloads + " downloads")}`,
      };
    }),
    required: false,
  });

  if (p.isCancel(selected)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  if (!selected || selected.length === 0) {
    p.log.info("No artifacts selected.");
    return;
  }

  console.log(`\n${color.yellow("The following artifacts will be deleted:")}\n`);
  for (const name of selected) {
    console.log(`  ${color.red("×")} ${(name as string).replace("extensions/", "")}`);
  }
  console.log();

  const confirmed = await p.confirm({
    message: `Are you sure you want to delete ${selected.length} artifact(s) from ${mode}?`,
    initialValue: false,
  });

  if (p.isCancel(confirmed) || !confirmed) {
    p.cancel("Deletion cancelled.");
    process.exit(0);
  }

  let deleted = 0;
  const errors: string[] = [];

  for (const name of selected) {
    const fileName = (name as string).replace("extensions/", "");
    try {
      await api.deleteExtensionArtifactFromCloud(fileName);
      deleted++;
    } catch (error) {
      errors.push(`${fileName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (deleted > 0) {
    p.log.success(`${color.green(`Deleted ${deleted} artifact(s)`)}`);
  }

  if (errors.length > 0) {
    p.log.error(`Failed to delete ${errors.length} artifact(s):`);
    for (const err of errors) {
      console.log(`  ${color.red("×")} ${err}`);
    }
  }
}

export async function deleteArtifactsCommand(mode?: "staging" | "production", prefix?: string) {
  const hasAllOptions = mode !== undefined;
  const isCI = process.env.CI === "true";

  if (hasAllOptions) {
    await deleteArtifacts(mode, prefix);
  } else if (isCI) {
    console.error("Error: --mode is required in CI mode");
    process.exit(1);
  } else {
    const resolved = await promptForOptions({ mode, prefix });
    await deleteArtifacts(resolved.mode, resolved.prefix);
  }
}
