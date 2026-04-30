import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import ListHolidays from "./components/list-holidays.js";

const server = new McpServer(
{ name: "public-holidays-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(ListHolidays);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Public Holidays MCP Server running on stdio");
}

main().catch(console.error);
