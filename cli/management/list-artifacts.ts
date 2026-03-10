import { styleText } from "node:util";
import { ApiClient } from "../lib/api.ts";
import { fetchAnalytics, formatAge, formatSize } from "./utils.ts";

const MCP_PREFIX = "mcps/";

async function listArtifacts(mode: "staging" | "production", prefix?: string) {
  const api = new ApiClient(mode);

  console.log(`\nFetching artifacts and analytics from ${mode}...`);

  const [artifacts, downloadCounts] = await Promise.all([
    api.listMcpArchivesInCloud(prefix),
    fetchAnalytics(mode),
  ]);

  if (artifacts.length === 0) {
    console.log("No artifacts found.");
    return;
  }

  console.log(`\nFound ${artifacts.length} artifact(s):\n`);

  const artifactsWithDownloads = artifacts.map((artifact) => {
    const fileName = artifact.name.replace(MCP_PREFIX, "");
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
    const name = artifact.name.replace(MCP_PREFIX, "");
    const size = formatSize(artifact.size);
    const age = formatAge(artifact.created);
    const downloads = artifact.downloads.toLocaleString();

    console.log(`  ${styleText("bold", name)}`);
    console.log(
      `    Uploaded: ${age}  |  Downloads in last 30 days: ${styleText("magenta", downloads)} | Size: ${styleText("yellow", size)}`,
    );
  }

  console.log();
}

export async function listArtifactsCommand(mode: "staging" | "production", prefix?: string) {
  await listArtifacts(mode, prefix);
}
