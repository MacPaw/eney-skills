import { Command } from "commander";
import { bundleCommand } from "./bundle/command.ts";
import { publishExtensionCommand } from "./management/publish.ts";
import { checkVersion } from "./management/check-version.ts";
import { packExtensionCommand } from "./management/pack.ts";

const program = new Command();

program
  .name("eney-extension-helper")
  .description("CLI for Eney Extension Helper")
  .version("1.0.0");

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
  .requiredOption("--extension-version <extensionVersion>", "Extension version")
  .requiredOption("--hash <hash>", "Hash")
  .requiredOption("--download-url <downloadUrl>", "Download URL")
  .option("--dry-run", "Do not publish remotely, just log actions", false)
  .action(({ cwd, extensionVersion, hash, downloadUrl, dryRun }) => publishExtensionCommand(cwd, extensionVersion, hash, downloadUrl, dryRun));

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
