import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import MoonPhaseWidget from "./components/get_moon_phase.js";

const server = new McpServer(
  { name: "moon-phase-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(MoonPhaseWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Moon Phase MCP Server running on stdio");
}

main().catch(console.error);
