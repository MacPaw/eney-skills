import { Command } from "commander";
import { bundleCommand } from "./bundle/command.ts";

const program = new Command();

program
  .name("eney-extension-helper")
  .description("CLI for Eney Extension Helper")
  .version("1.0.0");

program
  .command("bundle")
  .description("Bundle a tool")
  .action(() => bundleCommand());

program.parse(process.argv);
