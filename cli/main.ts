import dotenv from "dotenv";
import { Command } from "commander";
import path from "path";
import * as p from "@clack/prompts";
import { createCommand } from "./create/command.ts";
import { checkMcpVersionCommand } from "./management/check-mcp-version.ts";
import { uploadMcpArchiveCommand } from "./management/upload-mcp-archive.ts";
import { publishMcpMetadataCommand } from "./management/publish-mcp-metadata.ts";
import { analyticsCommand } from "./analytics/command.ts";
import { createTagsCommand } from "./management/create-tags.ts";
import { listArtifactsCommand } from "./management/list-artifacts.ts";
import { deleteArtifactsCommand } from "./management/delete-artifacts.ts";
import { extractMcpTools } from "./management/extract-mcp-tools.ts";
import { devMcpCommand } from "./dev/command.ts";

dotenv.config({ path: path.join(import.meta.dirname, ".env"), quiet: true });

const commands = {
  create: {
    label: "Create a new MCP server",
    action: () => createCommand({}),
  },
  "check-mcp-version": {
    label: "Check MCP version",
    action: () => checkMcpVersionCommand(),
  },
  "upload-mcp-archive": {
    label: "Upload MCP archive to cloud storage",
    action: () => uploadMcpArchiveCommand(),
  },
  "publish-mcp-metadata": {
    label: "Publish MCP metadata to backend",
    action: () => publishMcpMetadataCommand(),
  },
  analytics: {
    label: "Analyze download statistics from Cloudflare by path",
    action: () => analyticsCommand({}),
  },
  "create-tags": {
    label: "Create Git tags for production deployment",
    action: () => createTagsCommand(),
  },
  "list-artifacts": {
    label: "List artifacts in cloud storage",
    action: () => listArtifactsCommand(),
  },
  "delete-artifacts": {
    label: "Delete artifacts from cloud storage",
    action: () => deleteArtifactsCommand(),
  },
  dev: {
    label: "Start dev mode for MCP extension",
    action: () => devMcpCommand(),
  },
} as const;

type CommandName = keyof typeof commands;

async function showInteractiveMenu() {
  p.intro("Eney MCP Helper");

  const selected = await p.select({
    message: "What would you like to do?",
    options: Object.entries(commands).map(([value, { label }]) => ({ value, label })),
  });

  if (p.isCancel(selected)) {
    p.cancel("Operation cancelled.");
    process.exit(0);
  }

  await commands[selected as CommandName].action();
}

const program = new Command();

program.name("eney-mcp-helper").description("CLI for Eney MCP Helper").version("1.0.0");

program
  .command("create")
  .description("Create a new MCP server")
  .option("-o, --output <path>", "Output directory (defaults to current directory)")
  .option("--id <id>", "MCP server ID")
  .option("--mcp-title <title>", "MCP server title")
  .option("--tool-name <name>", "Tool name")
  .option("--tool-description <description>", "Tool description")
  .option("--tool-title <title>", "Tool title")
  .action(({ output, id, mcpTitle, toolName, toolDescription, toolTitle }) =>
    createCommand({ output, mcpId: id, mcpTitle, toolName, toolDescription, toolTitle }),
  );

program
  .command("analytics")
  .description("Analyze Cloudflare HTTP traffic by path")
  .option("--sort <order>", "Sort order: most or least")
  .option("--limit <n>", "Number of results to show")
  .option("--days <n>", "Number of days to analyze")
  .option("-o, --output <path>", "Output JSON file path")
  .option("--mode <mode>", "Environment mode (staging or production)")
  .action((options) => analyticsCommand(options));

program
  .command("create-tags")
  .description("Create Git tags for MCP versions")
  .action(() => createTagsCommand());

program
  .command("dev")
  .description(
    "Start dev mode for MCP extension (watches current directory for changes and rebuilds/deploys to MCP folder)",
  )
  .action(() => devMcpCommand());

program
  .command("list-artifacts")
  .description("List artifacts in cloud storage")
  .option("--mode <mode>", "Environment mode (staging or production)")
  .option("--prefix <prefix>", "Filter by prefix")
  .action(({ mode, prefix }) => listArtifactsCommand(mode, prefix));

program
  .command("delete-artifacts")
  .description("Delete artifacts from cloud storage")
  .option("--mode <mode>", "Environment mode (staging or production)")
  .option("--prefix <prefix>", "Filter by prefix")
  .action(({ mode, prefix }) => deleteArtifactsCommand(mode, prefix));

program
  .command("check-mcp-version")
  .description("Check MCP version")
  .option("--cwd <path>", "Current working directory")
  .option("--mode <mode>", "Mode (staging or production)")
  .action(({ cwd, mode }) => checkMcpVersionCommand(cwd, mode));

program
  .command("upload-mcp-archive")
  .description("Upload a pre-built .mcpb archive to cloud storage")
  .option("--archive-path <path>", "Path to .mcpb archive")
  .option("--mode <mode>", "Upload mode (staging or production)")
  .action(({ archivePath, mode }) => uploadMcpArchiveCommand(archivePath, mode));

program
  .command("publish-mcp-metadata")
  .description("Extract tools and publish MCP metadata to backend")
  .option("--mode <mode>", "Publish mode (staging or production)")
  .option("--archive-path <path>", "Path to .mcpb archive")
  .option("--tools-json <path>", "Path to pre-extracted tools JSON file (skips binary execution)")
  .action(({ mode, archivePath, toolsJson }) => publishMcpMetadataCommand(mode, archivePath, toolsJson));

program
  .command("extract-mcp-tools")
  .description("Extract tools from a built MCP server and write to JSON")
  .requiredOption("--mcp-dir <path>", "Path to unpacked MCP directory")
  .requiredOption("--output <path>", "Output JSON file path")
  .action(async ({ mcpDir, output }) => {
    const { resolve } = await import("path");
    const { writeFile } = await import("fs/promises");
    const tools = await extractMcpTools(mcpDir);
    await writeFile(resolve(output), JSON.stringify(tools, null, 2));
    console.log(`Wrote ${tools.length} tool(s) to ${output}`);
  });

const args = process.argv.slice(2);
const hasCommand = args.length > 0 && !args[0].startsWith("-");
const hasFlags = args.some((arg) => arg === "--help" || arg === "-h");
const isCI = process.env.CI === "true";

if (hasCommand || hasFlags || isCI) {
  program.parse(process.argv);
} else {
  showInteractiveMenu();
}
