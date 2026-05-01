import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import KanyeWidget from "./components/get_kanye_quote.js";

const server = new McpServer(
  { name: "kanye-quote-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(KanyeWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Kanye Quote MCP Server running on stdio");
}

main().catch(console.error);
