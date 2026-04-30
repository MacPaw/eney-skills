import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import SunriseSunsetWidget from "./components/get_sunrise_sunset.js";

const server = new McpServer(
  { name: "sunrise-sunset-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(SunriseSunsetWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Sunrise &amp; Sunset MCP Server running on stdio");
}

main().catch(console.error);
