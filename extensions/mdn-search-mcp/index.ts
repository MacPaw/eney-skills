import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import MdnSearchWidget from "./components/search_mdn.js";

const server = new McpServer(
  { name: "mdn-search-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(MdnSearchWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("MDN Search MCP Server running on stdio");
}

main().catch(console.error);
