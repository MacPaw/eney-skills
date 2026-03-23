#!/usr/bin/env node
// Run a command in each extension directory
// Usage: node scripts/foreach-extension.js npm i some-package@latest
//        node scripts/foreach-extension.js npm install
//        node scripts/foreach-extension.js cat manifest.json

import { readdirSync } from "fs";
import { join } from "path";
import { spawnSync } from "child_process";

const extensionsDir = join(import.meta.dirname, "../extensions");

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log("Usage: scripts/foreach-extension.js <command> [args...]");
  console.log(
    "Example: scripts/foreach-extension.js npm i some-package@latest",
  );
  process.exit(1);
}

const [command, ...commandArgs] = args;

const extensions = readdirSync(extensionsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

for (const name of extensions) {
  const extPath = join(extensionsDir, name);

  console.log(`=== ${name} ===`);

  const result = spawnSync(command, commandArgs, {
    cwd: extPath,
    stdio: "inherit",
    shell: true,
  });

  if (result.error) {
    console.error(`Error: ${result.error.message}`);
  }

  console.log("");
}
