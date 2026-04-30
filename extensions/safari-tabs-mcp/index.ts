import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import ListSafariTabs from "./components/list-safari-tabs.js";

const server = new McpServer(
{ name: "safari-tabs-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(ListSafariTabs);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Safari Tabs MCP Server running on stdio");
}

main().catch(console.error);
