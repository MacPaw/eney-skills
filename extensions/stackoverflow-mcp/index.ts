import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import StackOverflowWidget from "./components/search_stackoverflow.js";

const server = new McpServer(
  { name: "stackoverflow-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(StackOverflowWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Stack Overflow MCP Server running on stdio");
}

main().catch(console.error);
