import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import NetWorth from "./components/net-worth.js";
import AddPosition from "./components/add-position.js";

const server = new McpServer(
{ name: "net-worth-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(NetWorth);
uixServer.registerWidget(AddPosition);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Net Worth MCP Server running on stdio");
}

main().catch(console.error);
