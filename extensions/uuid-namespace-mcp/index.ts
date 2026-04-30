import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import NamespaceUUIDWidget from "./components/make_namespace_uuid.js";

const server = new McpServer(
  { name: "uuid-namespace-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(NamespaceUUIDWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("UUID v3/v5 MCP Server running on stdio");
}

main().catch(console.error);
