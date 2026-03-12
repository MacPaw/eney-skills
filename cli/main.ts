#!/usr/bin/env node
import dotenv from "dotenv";
import { Command } from "commander";
import path from "path";
import { createCommand } from "./create/command.ts";
import { checkMcpVersion } from "./management/check-mcp-version.ts";
import { uploadMcpArchive } from "./management/upload-mcp-archive.ts";
import { publishMcpMetadata } from "./management/publish-mcp-metadata.ts";
import { analyticsCommand } from "./analytics/command.ts";
import { listArtifacts } from "./management/list-artifacts.ts";
import { deleteArtifacts } from "./management/delete-artifacts.ts";
import { extractMcpTools } from "./management/extract-mcp-tools.ts";
import { devMcp } from "./dev/command.ts";

dotenv.config({ path: path.join(import.meta.dirname, ".env"), quiet: true });

const program = new Command();

program.name("eney-mcp-helper").description("CLI for Eney MCP Helper").version("1.0.0");

program
  .command("create")
  .description("Create a new MCP server")
  .option("-o, --output <path>", "Output directory", path.join(process.cwd(), "mcps"))
  .requiredOption("--id <id>", "MCP server ID")
  .requiredOption("--mcp-title <title>", "MCP server title")
  .requiredOption("--tool-name <name>", "Tool name")
  .requiredOption("--tool-description <description>", "Tool description")
  .requiredOption("--tool-title <title>", "Tool title")
  .action(({ output, id, mcpTitle, toolName, toolDescription, toolTitle }) =>
    createCommand({ output, mcpId: id, mcpTitle, toolName, toolDescription, toolTitle }),
  );

program
  .command("analytics")
  .description("Analyze Cloudflare HTTP traffic by path")
  .requiredOption("--sort <order>", "Sort order: most or least")
  .requiredOption("--limit <n>", "Number of results to show")
  .requiredOption("--days <n>", "Number of days to analyze")
  .requiredOption("--mode <mode>", "Environment mode (staging or production)")
  .option("-o, --output <path>", "Output JSON file path")
  .action((options) => analyticsCommand(options));

program
  .command("dev")
  .description(
    "Start dev mode for MCP extension (watches current directory for changes and rebuilds/deploys to MCP folder)",
  )
  .action(() => devMcp());

program
  .command("list-artifacts")
  .description("List artifacts in cloud storage")
  .requiredOption("--mode <mode>", "Environment mode (staging or production)")
  .option("--prefix <prefix>", "Filter by prefix")
  .action(({ mode, prefix }) => listArtifacts(mode, prefix));

program
  .command("delete-artifacts")
  .description("Delete artifacts from cloud storage")
  .requiredOption("--mode <mode>", "Environment mode (staging or production)")
  .requiredOption("--prefix <prefix>", "Filter by prefix")
  .option("--yes", "Skip confirmation and delete all matching artifacts")
  .action(({ mode, prefix, yes }) => deleteArtifacts(mode, prefix, yes));

program
  .command("check-mcp-version")
  .description("Check MCP version")
  .option("--cwd <path>", "Current working directory", ".")
  .requiredOption("--mode <mode>", "Mode (staging or production)")
  .action(({ cwd, mode }) => checkMcpVersion(cwd, mode));

program
  .command("upload-mcp-archive")
  .description("Upload a pre-built .mcpb archive to cloud storage")
  .requiredOption("--archive-path <path>", "Path to .mcpb archive")
  .requiredOption("--mode <mode>", "Upload mode (staging or production)")
  .action(({ archivePath, mode }) => uploadMcpArchive(archivePath, mode));

program
  .command("publish-mcp-metadata")
  .description("Extract tools and publish MCP metadata to backend")
  .requiredOption("--mode <mode>", "Publish mode (staging or production)")
  .requiredOption("--archive-path <path>", "Path to .mcpb archive")
  .option("--tools-json <path>", "Path to pre-extracted tools JSON file (skips binary execution)")
  .action(({ mode, archivePath, toolsJson }) => publishMcpMetadata(mode, archivePath, toolsJson));

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

program.parse(process.argv);
