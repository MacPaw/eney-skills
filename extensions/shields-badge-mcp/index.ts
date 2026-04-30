import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import ShieldsBadgeWidget from "./components/make_shields_badge.js";

const server = new McpServer(
  { name: "shields-badge-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(ShieldsBadgeWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Shields Badge MCP Server running on stdio");
}

main().catch(console.error);
