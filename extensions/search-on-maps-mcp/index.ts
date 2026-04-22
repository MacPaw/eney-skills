import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import SearchOnMaps from "./components/search-on-maps.js";

const server = new McpServer(
  { name: "search-on-maps-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(SearchOnMaps);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Search on Maps MCP Server running on stdio");
}

main().catch(console.error);
