import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import AirQualityWidget from "./components/get_air_quality.js";

const server = new McpServer(
  { name: "air-quality-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(AirQualityWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Air Quality MCP Server running on stdio");
}

main().catch(console.error);
