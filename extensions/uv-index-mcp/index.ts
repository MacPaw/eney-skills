import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import UVIndexWidget from "./components/get_uv_index.js";

const server = new McpServer(
  { name: "uv-index-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(UVIndexWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("UV Index MCP Server running on stdio");
}

main().catch(console.error);
