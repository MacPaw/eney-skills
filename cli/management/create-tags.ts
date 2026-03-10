import * as p from "@clack/prompts";
import { styleText } from "node:util";
import { exec, execSync } from "child_process";
import semver from "semver";

import { getMcpsInfo, type McpInfo } from "../lib/get-mcps.ts";

type McpOption = McpInfo & {
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

function formatMcpOption(mcp: McpInfo, remoteTags: string[]) {
  const label = `${styleText(["blue", "bold"], mcp.name)} ${styleText(["yellow", "bold"], `- ${mcp.version}`)}`;
  const baseOption = {
    value: { ...mcp, latestTag: null },
    label,
  };

  const mcpTags = remoteTags.filter((tag) => tag.startsWith(`${mcp.name}@`));

  if (mcpTags.length === 0) return baseOption;

  const formattedTags = mcpTags
    .map((tag) => ({
      version: tag.split("@")[1],
      tag: tag,
    }))
    .filter((t) => semver.coerce(t.version) !== null);

  if (formattedTags.length === 0) return baseOption;

  const latestTag = formattedTags.sort((a, b) =>
    semver.compare(semver.coerce(b.version)!, semver.coerce(a.version)!)
  )[0];

  return {
    value: { ...mcp, latestTag },
    label: `${label} ${styleText(["green", "bold"], `(latest production tag: @${latestTag.version})`)}`,
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

  const mcps = getMcpsInfo();
  const options = mcps.map((mcp) => formatMcpOption(mcp, remoteTags));

  const result = await p.autocompleteMultiselect<McpOption>({
    message: "Select MCPs (type to filter)",
    options,
    required: true,
  });

  if (p.isCancel(result)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  const selectedMcps = result;

  if (selectedMcps.length === 0) {
    p.outro("No MCPs were selected");
    process.exit(0);
  }

  const tagsToPush: string[] = [];

  for (const mcp of selectedMcps) {
    const { latestTag } = mcp;

    if (!latestTag) {
      tagsToPush.push(`${mcp.name}@${mcp.version}`);
      continue;
    }

    const coercedCurrent = semver.coerce(mcp.version);
    const coercedLatest = semver.coerce(latestTag.version);

    if (!coercedCurrent || !coercedLatest) {
      p.log.warn(
        `Unable to compare versions for ${mcp.name}: "${mcp.version}" vs "${latestTag.version}", skipping...`
      );
      continue;
    }

    if (semver.gt(coercedCurrent, coercedLatest)) {
      tagsToPush.push(`${mcp.name}@${mcp.version}`);
    } else {
      p.log.warn(
        `${mcp.name}@${mcp.version} is not greater than prod version ${latestTag.version}, skipping...`
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
    p.log.message(`Created tag ${styleText("green", tag)}`);
  }

  p.log.message(`To push the tags, run the following command: ${styleText(["cyan", "bold"], "git push origin --tags")}`);
  p.outro(`Successfully created ${styleText("green", String(tagsToPush.length))} tags.`);
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
