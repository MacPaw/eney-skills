import { resolve, normalize } from "path";

import { ApiClient } from "../lib/api.ts";

export async function uploadMcpArchive(archivePath: string, mode: "staging" | "production") {
  const api = new ApiClient(mode);
  const currentDir = process.cwd();
  const resolvedPath = resolve(currentDir, archivePath);

  // check for path traversal
  if (resolvedPath.indexOf(currentDir) !== 0) {
    throw new Error(`Invalid archive path for ${resolvedPath}: ${archivePath}`);
  }

  console.log(`Uploading archive: ${resolvedPath}`);
  await api.uploadMcpArchiveToCloud(resolvedPath);
  console.log("Archive uploaded successfully.");
}
