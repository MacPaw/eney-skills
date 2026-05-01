import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import TldrWidget from "./components/show_tldr.js";

const server = new McpServer(
  { name: "tldr-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(TldrWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("TLDR Pages MCP Server running on stdio");
}

main().catch(console.error);
