import { resolve } from "path";
import * as p from "@clack/prompts";

import { ApiClient } from "../lib/api.ts";

type UploadMcpArchiveOptions = {
  archivePath?: string;
  mode?: "staging" | "production";
};

async function promptForOptions(options: UploadMcpArchiveOptions) {
  p.intro("Upload MCP Archive");

  const answers = await p.group(
    {
      archivePath: () =>
        options.archivePath
          ? Promise.resolve(options.archivePath)
          : p.text({
              message: "Path to .mcpb archive:",
            }),
      mode: () =>
        options.mode
          ? Promise.resolve(options.mode)
          : p.select({
              message: "Upload mode:",
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
    archivePath: answers.archivePath as string,
    mode: answers.mode as "staging" | "production",
  };
}

async function uploadMcpArchive(archivePath: string, mode: "staging" | "production") {
  const api = new ApiClient(mode);
  const resolvedPath = resolve(archivePath);

  console.log(`Uploading archive: ${resolvedPath}`);
  await api.uploadMcpArchiveToCloud(resolvedPath);
  console.log("Archive uploaded successfully.");
}

export async function uploadMcpArchiveCommand(archivePath?: string, mode?: "staging" | "production") {
  const hasRequiredOptions = archivePath !== undefined && mode !== undefined;
  const isCI = process.env.CI === "true";

  if (hasRequiredOptions) {
    await uploadMcpArchive(archivePath, mode);
  } else if (isCI) {
    console.error("Error: --archive-path and --mode are required in CI mode");
    process.exit(1);
  } else {
    const resolved = await promptForOptions({ archivePath, mode });
    await uploadMcpArchive(resolved.archivePath, resolved.mode);
  }
}
