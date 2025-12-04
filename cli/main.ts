import { Command } from "commander";
import { bundleCommand } from "./bundle/command.ts";
import { createCommand } from "./create/command.ts";
import { publishExtensionCommand } from "./management/publish.ts";
import { checkVersionCommand } from "./management/check-version.ts";
import { packExtensionCommand } from "./management/pack.ts";
import { analyticsCommand } from "./analytics/command.ts";

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
  .option("-o, --output <path>", "Output folder", "../../../eney-jsx-runtime/extensions")
  .option("--cwd <path>", "Current working directory", process.cwd())
  .action(({ output, cwd }) => bundleCommand(output, cwd));

program
  .command("publish")
  .description("Publish a tool")
  .option("--cwd <path>", "Current working directory", process.cwd())
  .option("--mode <mode>", "Publish mode", "staging")
  .option("--dry-run", "Do not publish remotely, just log actions", false)
  .action(({ cwd, mode, dryRun }) => publishExtensionCommand(cwd, mode, dryRun));

program
  .command("check-version")
  .description("Check version")
  .option("--cwd <path>", "Current working directory", process.cwd())
  .action(({ cwd }) => checkVersionCommand(cwd));

program
  .command("pack")
  .description("Create extension archive")
  .option("--cwd <path>", "Current working directory", process.cwd())
  .option("-o, --output <path>", "Directory to place the archive")
  .action(({ cwd, output }) => packExtensionCommand(cwd, output));

program
  .command("analytics")
  .description("Analyze Cloudflare HTTP traffic by path")
  .option("--sort <order>", "Sort order: most or least", "most")
  .option("--limit <n>", "Number of results to show", "50")
  .option("-o, --output <path>", "Output JSON file path")
  .option("--host <hostname>", "Request host to filter", "staging-cdn.eney.ai")
  .action((options) => analyticsCommand(options));

program.parse(process.argv);
