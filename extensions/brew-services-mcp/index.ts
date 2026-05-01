import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import BrewServicesWidget from "./components/brew_services.js";

const server = new McpServer(
  { name: "brew-services-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(BrewServicesWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Brew Services MCP Server running on stdio");
}

main().catch(console.error);
