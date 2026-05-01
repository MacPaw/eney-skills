import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import RickMortyWidget from "./components/get_rick_morty_character.js";

const server = new McpServer(
  { name: "rick-and-morty-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(RickMortyWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Rick and Morty MCP Server running on stdio");
}

main().catch(console.error);
