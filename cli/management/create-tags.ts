import * as p from "@clack/prompts";
import color from "picocolors";
import { exec, execSync } from "child_process";
import semver from "semver";

import { getExtensionsInfo } from "../lib/get-extensions.ts";
import type { ExtensionInfo } from "../lib/types.ts";

type ExtensionOption = ExtensionInfo & {
  latestTag: {
    version: string;
    tag: string;
  } | null;
};

async function fetchTagsFromGit(): Promise<string[]> {
  return new Promise((resolve, reject) => {
    exec("git ls-remote --tags origin | awk -F/ '{print $3}'", (error, stdout) => {
      if (error) {
        reject(error);
      }
      resolve(stdout.trim().split("\n"));
    });
  });
}

function formatExtensionOption(extension: ExtensionInfo, remoteTags: string[]) {
  const label = `${color.bold(color.blue(extension.name))} ${color.bold(color.yellow(`- ${extension.version}`))}`;
  const baseOption = {
    value: { ...extension, latestTag: null },
    label,
  };

  const extensionsTags = remoteTags.filter((tag) => tag.startsWith(`${extension.name}@`));

  if (extensionsTags.length === 0) return baseOption;

  const formattedTags = extensionsTags.map((tag) => {
    return {
      version: tag.split("@")[1],
      tag: tag,
    };
  });

  const latestTag = formattedTags.sort((a, b) => semver.compare(semver.coerce(b.version), semver.coerce(a.version)))[0];

  return {
    value: { ...extension, latestTag },
    label: `${label} ${color.bold(color.green(`(latest production tag: @${latestTag.version})`))}`,
  };
}

async function createTags() {
  p.intro("Create tags");

  let remoteTags: string[] = [];

  const fetchSpinner = p.spinner();
  fetchSpinner.start("Fetching tags from Git...");

  try {
    remoteTags = await fetchTagsFromGit();
  } catch {
    p.log.error("Failed to fetch tags from Git");
    process.exit(1);
  }

  fetchSpinner.stop("Tags fetched successfully");

  const extensions = getExtensionsInfo();
  const options = extensions.map((extension) => formatExtensionOption(extension, remoteTags));

  const result = await p.autocompleteMultiselect<ExtensionOption>({
    message: "Select extensions (type to filter)",
    options,
  });

  if (p.isCancel(result)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  const selectedExtensions = result;

  if (selectedExtensions.length === 0) {
    p.outro("No extensions were selected");
    process.exit(0);
  }

  const tagsToPush: string[] = [];

  for (const extension of selectedExtensions) {
    const { latestTag } = extension;

    if (!latestTag) {
      tagsToPush.push(`${extension.name}@${extension.version}`);
      continue;
    }

    const coercedCurrent = semver.coerce(extension.version);
    const coercedLatest = semver.coerce(latestTag.version);

    if (!coercedCurrent || !coercedLatest) {
      p.log.warn(
        `Unable to compare versions for ${extension.name}: "${extension.version}" vs "${latestTag.version}", skipping...`
      );
      continue;
    }

    if (semver.gt(coercedCurrent, coercedLatest)) {
      tagsToPush.push(`${extension.name}@${extension.version}`);
    } else {
      p.log.warn(
        `${extension.name}@${extension.version} is not greater than prod version ${latestTag.version}, skipping...`
      );
      continue;
    }
  }

  if (tagsToPush.length === 0) {
    p.outro("No tags to create");
    process.exit(0);
  }

  p.log.message(tagsToPush.join("\n"));

  const confirmResult = await p.confirm({
    message: "Are you sure you want to create these tags?",
    initialValue: false,
  });

  if (p.isCancel(confirmResult) || !confirmResult) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  for (const tag of tagsToPush) {
    try {
      execSync(`git tag ${tag}`);
    } catch (error) {
      p.log.error(`Failed to create tag ${tag}: ${error}`);
      process.exit(1);
    }
    p.log.message(`Created tag ${color.green(tag)}`);
  }

  p.log.message(`To push the tags, run the following command: ${color.bold(color.cyan("git push origin --tags"))}`);
  p.outro(`Successfully created ${color.green(tagsToPush.length)} tags.`);
}

export async function createTagsCommand() {
  const isCI = process.env.CI === "true";

  if (isCI) {
    console.error(
      "Error: create-tags command is not supported in CI mode. You can create tags manually by running the following command: git tag <tag-name>"
    );
    process.exit(1);
  } else {
    await createTags();
  }
}
