import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import SpotifyControlWidget from "./components/control_spotify.js";

const server = new McpServer(
  { name: "spotify-control-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(SpotifyControlWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Spotify Control MCP Server running on stdio");
}

main().catch(console.error);
