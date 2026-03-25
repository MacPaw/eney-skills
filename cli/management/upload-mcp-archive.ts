import { resolve, normalize } from "path";

import { ApiClient } from "../lib/api.ts";

export async function uploadMcpArchive(archivePath: string, mode: "staging" | "production") {
  const api = new ApiClient(mode);
  const resolvedPath = resolve(archivePath);

  // check for path traversal
  if (resolvedPath.indexOf(archivePath) !== 0) {
    throw new Error(`Invalid archive path: ${archivePath}`);
  }

  console.log(`Uploading archive: ${resolvedPath}`);
  await api.uploadMcpArchiveToCloud(resolvedPath);
  console.log("Archive uploaded successfully.");
}
