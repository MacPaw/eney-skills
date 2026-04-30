import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import NowPlaying from "./components/now-playing.js";

const server = new McpServer(
{ name: "apple-music-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(NowPlaying);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Apple Music MCP Server running on stdio");
}

main().catch(console.error);
