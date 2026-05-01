import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import TileWindowWidget from "./components/tile_window.js";

const server = new McpServer(
  { name: "window-tile-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(TileWindowWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Window Tile MCP Server running on stdio");
}

main().catch(console.error);
