import { styleText } from "node:util";
import { ApiClient } from "../lib/api.ts";
import { fetchAnalytics, formatAge, formatSize } from "./utils.ts";

const MCP_PREFIX = "mcps/";

async function deleteArtifacts(mode: "staging" | "production", prefix: string, yes: boolean) {
  const api = new ApiClient(mode);

  console.log("Fetching artifacts and analytics...");

  const [artifacts, downloadCounts] = await Promise.all([
    api.listMcpArchivesInCloud(prefix),
    fetchAnalytics(mode),
  ]);

  if (artifacts.length === 0) {
    console.log("No artifacts found.");
    return;
  }

  const artifactsWithDownloads = artifacts.map((artifact) => {
    const fileName = artifact.name.replace(MCP_PREFIX, "");
    return {
      ...artifact,
      downloads: downloadCounts.get(fileName) ?? 0,
    };
  });

  const sortedArtifacts = artifactsWithDownloads.sort((a, b) => a.downloads - b.downloads);

  console.log(`\nArtifacts matching prefix "${prefix}" (${mode}):\n`);
  for (const artifact of sortedArtifacts) {
    const name = artifact.name.replace(MCP_PREFIX, "");
    const size = formatSize(artifact.size);
    const age = formatAge(artifact.created);
    const downloads = artifact.downloads.toLocaleString();
    console.log(`  ${styleText(["blue", "bold"], name)} - ${styleText("yellow", size)} | ${styleText("cyan", age)} | ${styleText("magenta", downloads + " downloads")}`);
  }

  if (!yes) {
    console.log(`\nTo delete these artifacts, re-run with --yes`);
    return;
  }

  let deleted = 0;
  const errors: string[] = [];

  for (const artifact of sortedArtifacts) {
    const fileName = artifact.name.replace(MCP_PREFIX, "");
    try {
      await api.deleteMcpArtifactFromCloud(fileName);
      deleted++;
    } catch (error) {
      errors.push(`${fileName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (deleted > 0) {
    console.log(`${styleText("green", `Deleted ${deleted} artifact(s)`)}`);
  }

  if (errors.length > 0) {
    console.error(`Failed to delete ${errors.length} artifact(s):`);
    for (const err of errors) {
      console.log(`  ${styleText("red", "×")} ${err}`);
    }
  }
}

export async function deleteArtifactsCommand(mode: "staging" | "production", prefix: string, yes?: boolean) {
  await deleteArtifacts(mode, prefix, yes ?? false);
}
