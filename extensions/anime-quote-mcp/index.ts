import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import AnimeQuoteWidget from "./components/get_anime_quote.js";

const server = new McpServer(
  { name: "anime-quote-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(AnimeQuoteWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Anime Quote MCP Server running on stdio");
}

main().catch(console.error);
