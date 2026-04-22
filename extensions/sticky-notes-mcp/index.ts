import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import CreateStickyNote from "./components/create-sticky-note.js";

const server = new McpServer(
  { name: "sticky-notes-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(CreateStickyNote);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Sticky Notes MCP Server running on stdio");
}

main().catch(console.error);
