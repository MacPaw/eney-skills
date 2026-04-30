import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import CatFactWidget from "./components/get_cat_fact.js";

const server = new McpServer(
  { name: "cat-fact-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(CatFactWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Cat Fact MCP Server running on stdio");
}

main().catch(console.error);
