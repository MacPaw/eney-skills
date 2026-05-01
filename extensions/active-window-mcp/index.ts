import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import ActiveWindowWidgetDef from "./components/show_active_window.js";

const server = new McpServer(
  { name: "active-window-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(ActiveWindowWidgetDef);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Active Window MCP Server running on stdio");
}

main().catch(console.error);
