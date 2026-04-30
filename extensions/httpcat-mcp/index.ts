import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import HttpCatWidget from "./components/http_status_cat.js";

const server = new McpServer(
  { name: "httpcat-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(HttpCatWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("HTTP Cat MCP Server running on stdio");
}

main().catch(console.error);
