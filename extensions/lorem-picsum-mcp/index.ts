import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import PicsumWidget from "./components/placeholder_image.js";

const server = new McpServer(
  { name: "lorem-picsum-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(PicsumWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Lorem Picsum MCP Server running on stdio");
}

main().catch(console.error);
