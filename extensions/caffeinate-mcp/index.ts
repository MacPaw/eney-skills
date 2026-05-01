import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import CaffeinateWidget from "./components/caffeinate.js";

const server = new McpServer(
  { name: "caffeinate-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(CaffeinateWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Caffeinate MCP Server running on stdio");
}

main().catch(console.error);
