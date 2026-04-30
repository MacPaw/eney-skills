import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import WikipediaWidget from "./components/wikipedia_summary.js";

const server = new McpServer(
  { name: "wikipedia-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(WikipediaWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Wikipedia MCP Server running on stdio");
}

main().catch(console.error);
