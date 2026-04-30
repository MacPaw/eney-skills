import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import FlipCoinWidget from "./components/flip_coin.js";

const server = new McpServer(
  { name: "flip-coin-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(FlipCoinWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Coin Flip MCP Server running on stdio");
}

main().catch(console.error);
