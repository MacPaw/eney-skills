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
  const mcpPath = resolve(join(mcpDir, "dist"));
  const manifestPath = join(mcpPath, "manifest.json");

  // Read manifest to get entry point
  let manifest: any;
  try {
    const manifestRaw = await fs.readFile(manifestPath, "utf8");
    manifest = JSON.parse(manifestRaw);
  } catch (error: any) {
    throw new Error(`Unable to read manifest at ${manifestPath}: ${error.message}`);
  }

  if (!manifest.server?.entry_point) {
    throw new Error(`Missing "server.entry_point" field in manifest at ${manifestPath}`);
  }

  // Resolve entry point path
  const entryPointPath = join(mcpPath, manifest.server.entry_point);

  try {
    await fs.stat(entryPointPath);
  } catch {
    throw new Error(`Entry point not found: ${entryPointPath}. Did you run 'npm run build' in the MCP directory?`);
  }

  // Get command and args from manifest or use defaults
  const command = manifest.server.mcp_config?.command || "node";
  const args = manifest.server.mcp_config?.args || [entryPointPath];

  // Resolve ${__dirname} placeholder in args
  const resolvedArgs = args.map((arg: string) => arg.replace("${__dirname}", mcpPath));

  console.log(`Extracting tools from MCP server at ${entryPointPath}...`);

  let client: Client | undefined;

  try {
    // Create transport and client
    const transport = new StdioClientTransport({
      command,
      args: resolvedArgs,
      env: process.env,
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

    // Connect with timeout
    await Promise.race([
      client.connect(transport),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout connecting to MCP server")), 30000)),
    ]);

    // List tools
    const result = (await Promise.race([
      client.listTools(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout listing tools from MCP server")), 30000)),
    ])) as Awaited<ReturnType<Client["listTools"]>>;

    // Filter out internal MCP tools
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
