import { join, resolve } from "path";
import fs from "fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export type ToolWithSchema = {
  name: string;
  description?: string;
  inputSchema: Record<string, any>;
  outputSchema?: Record<string, any>;
  annotations?: Record<string, any>;
};

export async function extractMcpTools(mcpDir: string): Promise<ToolWithSchema[]> {
  const currentDir = process.cwd();
  const resolvedMcpDir = resolve(currentDir, mcpDir);

  if (resolvedMcpDir.indexOf(currentDir) !== 0) {
    throw new Error(`Invalid MCP directory path for ${resolvedMcpDir}: ${mcpDir}`);
  }

  // Node MCPs keep their manifest in dist/; binary (Swift) MCPs keep it at root
  let mcpPath: string;
  let manifest: Record<string, any>;
  try {
    const distManifestPath = join(resolvedMcpDir, "dist", "manifest.json");
    manifest = JSON.parse(await fs.readFile(distManifestPath, "utf8"));
    mcpPath = join(resolvedMcpDir, "dist");
  } catch {
    const rootManifestPath = join(resolvedMcpDir, "manifest.json");
    try {
      manifest = JSON.parse(await fs.readFile(rootManifestPath, "utf8"));
      mcpPath = resolvedMcpDir;
    } catch (error: any) {
      throw new Error(`Unable to read manifest from dist/ or root of ${resolvedMcpDir}: ${error.message}`);
    }
  }

  if (!manifest.server?.entry_point) {
    throw new Error(`Missing "server.entry_point" field in manifest at ${mcpPath}`);
  }

  // Resolve entry point path
  const entryPointPath = join(mcpPath, manifest.server.entry_point);

  try {
    await fs.stat(entryPointPath);
  } catch {
    throw new Error(`Entry point not found: ${entryPointPath}. Did you build the MCP server?`);
  }

  // For binary MCPs the entry point is the executable; for node MCPs use mcp_config
  const isBinary = manifest.server?.type === "binary";
  let command: string;
  let resolvedArgs: string[];

  if (isBinary) {
    command = entryPointPath;
    resolvedArgs = [];
  } else {
    command = manifest.server.mcp_config?.command || "node";
    const args = manifest.server.mcp_config?.args || [entryPointPath];
    resolvedArgs = args.map((arg: string) => arg.replace("${__dirname}", mcpPath));
  }

  console.log(`Extracting tools from MCP server at ${entryPointPath}...`);

  let client: Client | undefined;

  try {
    const transport = new StdioClientTransport({
      command,
      args: resolvedArgs,
      env: process.env as Record<string, string>,
    });

    client = new Client(
      {
        name: "eney-cli-tool-extractor",
        version: "1.0.0",
      },
      {
        capabilities: {},
      },
    );

    await Promise.race([
      client.connect(transport),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout connecting to MCP server")), 30000)),
    ]);

    const result = (await Promise.race([
      client.listTools(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout listing tools from MCP server")), 30000)),
    ])) as Awaited<ReturnType<Client["listTools"]>>;

    const excludedTools = ["send-event", "widget-tree"];
    const filteredTools = result.tools.filter((tool) => !excludedTools.includes(tool.name));

    console.log(
      `Extracted ${filteredTools.length} tool(s) (filtered out ${result.tools.length - filteredTools.length} internal tool(s))`,
    );

    // Transform to our format
    const toolsWithSchema: ToolWithSchema[] = filteredTools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema || {},
      outputSchema: tool.outputSchema,
      annotations: tool.annotations,
    }));

    return toolsWithSchema;
  } catch (error: any) {
    throw new Error(`Failed to extract tools from MCP server: ${error.message}`);
  } finally {
    // Clean up: close client connection
    if (client) {
      try {
        await client.close();
      } catch (error) {
        // Ignore cleanup errors
        console.error("Warning: Failed to close MCP client connection:", error);
      }
    }
  }
}
