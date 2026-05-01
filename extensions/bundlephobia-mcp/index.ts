import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import BundleSizeWidget from "./components/get_bundle_size.js";

const server = new McpServer(
  { name: "bundlephobia-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(BundleSizeWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Bundle Size MCP Server running on stdio");
}

main().catch(console.error);
