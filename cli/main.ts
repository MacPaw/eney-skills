import { Command } from "commander";
import { bundleCommand } from "./bundle/command.ts";
import { createCommand } from "./create/command.ts";
import { publishExtensionCommand } from "./management/publish.ts";
import { checkVersion } from "./management/check-version.ts";
import { packExtensionCommand } from "./management/pack.ts";

const program = new Command();

program
  .name("eney-extension-helper")
  .description("CLI for Eney Extension Helper")
  .version("1.0.0");

program
  .command("create")
  .description("Create a new extension")
  .option("-o, --output <path>", "Output directory (defaults to current directory)")
  .action((options) => createCommand(options));

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
  .action(({ cwd }) => checkVersion(cwd));

program
  .command("pack")
  .description("Create extension archive")
  .option("--cwd <path>", "Current working directory", process.cwd())
  .option("-o, --output <path>", "Directory to place the archive")
  .action(({ cwd, output }) => packExtensionCommand(cwd, output));

program.parse(process.argv);
