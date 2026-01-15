import * as p from "@clack/prompts";
import color from "picocolors";
import { execSync } from "child_process";
import semver from "semver";

import { getExtensionsInfo } from "../lib/get-extensions.ts";
import type { ExtensionInfo } from "../lib/types.ts";

function getLatestExtensionTagFromGit(extensionName: string) {
  let tags: string[] = [];
  try {
    const output = execSync(`git tag -l | grep ${extensionName}@`).toString().trim();
    tags = output.length > 0 ? output.split("\n") : [];
  } catch {
    tags = [];
  }

  if (tags.length === 0) {
    return null;
  }

  const formattedTags = tags.map((tag) => {
    return {
      version: tag.split("@")[1],
      tag: tag,
    };
  });

  const latestTagVersion = formattedTags.sort((a, b) =>
    semver.compare(semver.coerce(b.version), semver.coerce(a.version))
  )[0];

  return latestTagVersion;
}

function formatExtensionInfo(extension: ExtensionInfo) {
  const latestTag = getLatestExtensionTagFromGit(extension.name);
  const label = `${color.bold(color.blue(extension.name))} ${color.bold(color.yellow(`- ${extension.version}`))}`;

  if (!latestTag) {
    return {
      value: extension,
      label,
    };
  }

  return {
    value: extension,
    label: `${label} ${color.bold(color.green(`(latest production tag: @${latestTag.version})`))}`,
  };
}

async function createTags() {
  p.intro("Create tags");

  const extensions = getExtensionsInfo();

  const options = extensions.map(formatExtensionInfo);

  const result = await p.autocompleteMultiselect<ExtensionInfo>({
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
    const latestTag = getLatestExtensionTagFromGit(extension.name);

    if (!latestTag) {
      tagsToPush.push(`${extension.name}@${extension.version}`);
      continue;
    }

    if (semver.gt(semver.coerce(extension.version), semver.coerce(latestTag.version))) {
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

  if (p.isCancel(confirmResult)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  } else {
    for (const tag of tagsToPush) {
      execSync(`git tag ${tag}`);
      p.log.message(`Created tag ${color.green(tag)}`);
    }

    p.log.message(`To push the tags, run the following command: ${color.bold(color.cyan("git push origin"))}`);
    p.outro(`Successfully created ${color.green(tagsToPush.length)} tags.`);
  }
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
