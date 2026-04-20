import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import SetupDevEnvironment from "./components/setup-dev-environment.js";

const server = new McpServer(
  { name: "eney-dev-setup-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(SetupDevEnvironment);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Eney Dev Setup MCP Server running on stdio");
}

main().catch(console.error);
