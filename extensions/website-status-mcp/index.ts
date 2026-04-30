import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import CheckWebsite from "./components/check-website.js";

const server = new McpServer(
{ name: "website-status-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(CheckWebsite);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Website Status MCP Server running on stdio");
}

main().catch(console.error);
