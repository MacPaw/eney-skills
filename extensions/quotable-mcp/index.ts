import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import QuotableWidget from "./components/get_random_quote.js";

const server = new McpServer(
  { name: "quotable-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(QuotableWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Quotable MCP Server running on stdio");
}

main().catch(console.error);
