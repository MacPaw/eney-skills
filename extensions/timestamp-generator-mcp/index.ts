import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import GenerateTimestamps from "./components/generate-timestamps.js";

const server = new McpServer(
  { name: "timestamp-generator-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(GenerateTimestamps);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Timestamp Generator MCP Server running on stdio");
}

main().catch(console.error);
