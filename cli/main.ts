import dotenv from "dotenv";
import { Command } from "commander";
import path from "path";
import * as p from "@clack/prompts";
import { bundleCommand } from "./bundle/command.ts";
import { createCommand } from "./create/command.ts";
import { checkVersionCommand } from "./management/check-version.ts";
import { packExtensionCommand } from "./management/pack.ts";
import { uploadArchiveCommand } from "./management/upload-archive.ts";
import { publishExtensionCommand } from "./management/publish.ts";
import { checkMcpVersionCommand } from "./management/check-mcp-version.ts";
import { packMcpCommand } from "./management/pack-mcp.ts";
import { uploadMcpArchiveCommand } from "./management/upload-mcp-archive.ts";
import { publishMcpCommand } from "./management/publish-mcp.ts";
import { analyticsCommand } from "./analytics/command.ts";
import { createTagsCommand } from "./management/create-tags.ts";
import { listArtifactsCommand } from "./management/list-artifacts.ts";
import { deleteArtifactsCommand } from "./management/delete-artifacts.ts";
import { devCommand } from "./dev/command.ts";

dotenv.config({ path: path.join(import.meta.dirname, ".env"), quiet: true });

const commands = {
  create: {
    label: "Create a new extension",
    action: () => createCommand({}),
  },
  bundle: {
    label: "Bundle a tool",
    action: () => bundleCommand(),
  },
  "check-version": {
    label: "Check version",
    action: () => checkVersionCommand(),
  },
  pack: {
    label: "Create extension archive",
    action: () => packExtensionCommand(),
  },
  "upload-archive": {
    label: "Pack and upload archive to cloud storage",
    action: () => uploadArchiveCommand(),
  },
  publish: {
    label: "Publish extension metadata to backend",
    action: () => publishExtensionCommand(),
  },
  "check-mcp-version": {
    label: "Check MCP version",
    action: () => checkMcpVersionCommand(),
  },
  "pack-mcp": {
    label: "Create MCP archive",
    action: () => packMcpCommand(),
  },
  "upload-mcp-archive": {
    label: "Pack and upload MCP archive to cloud storage",
    action: () => uploadMcpArchiveCommand(),
  },
  "publish-mcp": {
    label: "Publish MCP metadata to backend",
    action: () => publishMcpCommand(),
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
} as const;

type CommandName = keyof typeof commands;

async function showInteractiveMenu() {
  p.intro("Eney Extension Helper");

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

program.name("eney-extension-helper").description("CLI for Eney Extension Helper").version("1.0.0");

program
  .command("create")
  .description("Create a new extension")
  .option("-o, --output <path>", "Output directory (defaults to current directory)")
  .option("--id <id>", "Extension ID")
  .option("--extension-title <title>", "Extension title")
  .option("--tool-name <name>", "Tool name")
  .option("--tool-description <description>", "Tool description")
  .option("--tool-title <title>", "Tool title", "Tool title")
  .action(({ output, id, extensionTitle, toolName, toolDescription, toolTitle }) =>
    createCommand({ output, extensionId: id, extensionTitle, toolName, toolDescription, toolTitle }),
  );

program
  .command("bundle")
  .description("Bundle a tool")
  .option("-o, --output <path>", "Output folder")
  .option("--cwd <path>", "Current working directory")
  .action(({ output, cwd }) => bundleCommand(output, cwd));

program
  .command("check-version")
  .description("Check version")
  .option("--cwd <path>", "Current working directory")
  .option("--mode <mode>", "Mode (staging or production)")
  .action(({ cwd, mode }) => checkVersionCommand(cwd, mode));

program
  .command("pack")
  .description("Create extension archive")
  .option("--cwd <path>", "Current working directory")
  .option("-o, --output <path>", "Directory to place the archive")
  .action(({ cwd, output }) => packExtensionCommand(cwd, output));

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
  .description("Create Git tags for extension versions")
  .action(() => createTagsCommand());

program
  .command("dev")
  .description("Develop an extension")
  .action(() => devCommand());

program
  .command("upload-archive")
  .description("Pack and upload archive to cloud storage")
  .option("--cwd <path>", "Current working directory")
  .option("--mode <mode>", "Upload mode (staging or production)")
  .option("--dry-run <value>", "Do not upload remotely, just log actions", (value) => value !== "false")
  .action(({ cwd, mode, dryRun }) => uploadArchiveCommand(cwd, mode, dryRun));

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
  .command("publish")
  .description("Publish extension metadata to backend")
  .option("--cwd <path>", "Current working directory")
  .option("--mode <mode>", "Publish mode (staging or production)")
  .option("--extension-version <version>", "Extension version")
  .option("--hash <hash>", "Archive hash (SHA-256)")
  .option("--download-url <url>", "Archive download URL")
  .option("--dry-run <value>", "Do not publish remotely, just log actions", (value) => value !== "false")
  .action(({ cwd, mode, extensionVersion, hash, downloadUrl, dryRun }) =>
    publishExtensionCommand(cwd, mode, extensionVersion, hash, downloadUrl, dryRun),
  );

program
  .command("check-mcp-version")
  .description("Check MCP version")
  .option("--cwd <path>", "Current working directory")
  .option("--mode <mode>", "Mode (staging or production)")
  .action(({ cwd, mode }) => checkMcpVersionCommand(cwd, mode));

program
  .command("pack-mcp")
  .description("Create MCP archive")
  .option("--cwd <path>", "Current working directory")
  .option("-o, --output <path>", "Directory to place the archive")
  .action(({ cwd, output }) => packMcpCommand(cwd, output));

program
  .command("upload-mcp-archive")
  .description("Pack and upload MCP archive to cloud storage")
  .option("--cwd <path>", "Current working directory")
  .option("--mode <mode>", "Upload mode (staging or production)")
  .option("--dry-run <value>", "Do not upload remotely, just log actions", (value) => value !== "false")
  .action(({ cwd, mode, dryRun }) => uploadMcpArchiveCommand(cwd, mode, dryRun));

program
  .command("publish-mcp")
  .description("Pack, upload to GCS, and publish MCP to backend")
  .option("--cwd <path>", "Current working directory")
  .option("--mode <mode>", "Publish mode (staging or production)")
  .option("--dry-run <value>", "Do not publish remotely, just log actions", (value) => value !== "false")
  .action(({ cwd, mode, dryRun }) => publishMcpCommand(cwd, mode, dryRun));

const args = process.argv.slice(2);
const hasCommand = args.length > 0 && !args[0].startsWith("-");
const hasFlags = args.some((arg) => arg === "--help" || arg === "-h");
const isCI = process.env.CI === "true";

if (hasCommand || hasFlags || isCI) {
  program.parse(process.argv);
} else {
  showInteractiveMenu();
}
