import dotenv from "dotenv";
import { Command } from "commander";
import path from "path";
import * as p from "@clack/prompts";
import { bundleCommand } from "./bundle/command.ts";
import { createCommand } from "./create/command.ts";
import { publishExtensionCommand } from "./management/publish.ts";
import { checkVersionCommand } from "./management/check-version.ts";
import { packExtensionCommand } from "./management/pack.ts";
import { analyticsCommand } from "./analytics/command.ts";
import { createTagsCommand } from "./management/create-tags.ts";

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
  publish: {
    label: "Publish a tool",
    action: () => publishExtensionCommand(),
  },
  "check-version": {
    label: "Check version",
    action: () => checkVersionCommand(),
  },
  pack: {
    label: "Create extension archive",
    action: () => packExtensionCommand(),
  },
  analytics: {
    label: "Analyze download stats of extensions",
    action: () => analyticsCommand({}),
  },
  "create-tags": {
    label: "Create Git tags for production deployment",
    action: () => createTagsCommand(),
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
    createCommand({ output, extensionId: id, extensionTitle, toolName, toolDescription, toolTitle })
  );

program
  .command("bundle")
  .description("Bundle a tool")
  .option("-o, --output <path>", "Output folder")
  .option("--cwd <path>", "Current working directory")
  .action(({ output, cwd }) => bundleCommand(output, cwd));

program
  .command("publish")
  .description("Publish a tool")
  .option("--cwd <path>", "Current working directory")
  .option("--mode <mode>", "Publish mode (staging or production)")
  .option("--dry-run", "Do not publish remotely, just log actions", (value) => value === "true")
  .action(({ cwd, mode, dryRun }) => publishExtensionCommand(cwd, mode, dryRun));

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
  .option("--host <hostname>", "Request host to filter")
  .action((options) => analyticsCommand(options));

program
  .command("create-tags")
  .description("Create tags")
  .action(() => createTagsCommand());

const args = process.argv.slice(2);
const hasCommand = args.length > 0 && !args[0].startsWith("-");
const hasFlags = args.some((arg) => arg === "--help" || arg === "-h" || arg === "--version" || arg === "-V");
const isCI = process.env.CI === "true";

if (hasCommand || hasFlags || isCI) {
  program.parse(process.argv);
} else {
  showInteractiveMenu();
}
