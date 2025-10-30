import { Command } from "commander";
import { bundleCommand } from "./bundle/command.ts";
import { publishExtension } from "./management/publish.ts";

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
  .action(({ cwd }) => publishExtension(cwd));

program.parse(process.argv);
