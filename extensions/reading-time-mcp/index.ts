import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import ReadingTimeWidget from "./components/estimate_reading_time.js";

const server = new McpServer(
  { name: "reading-time-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(ReadingTimeWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Reading Time MCP Server running on stdio");
}

main().catch(console.error);
