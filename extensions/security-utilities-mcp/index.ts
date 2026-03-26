import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import NewPassword from "./components/new-password.js";

const server = new McpServer(
  {
    name: "security-utilities-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      logging: {},
      resources: {},
    },
  },
);

const uixServer = setupUIXForMCP(server);

uixServer.registerWidget(NewPassword);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Eney MCP Server running on stdio");
}

main().catch(console.error);
