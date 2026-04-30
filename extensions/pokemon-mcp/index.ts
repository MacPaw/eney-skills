import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import PokemonWidget from "./components/get_pokemon.js";

const server = new McpServer(
  { name: "pokemon-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(PokemonWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Pokémon MCP Server running on stdio");
}

main().catch(console.error);
