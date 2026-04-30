import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import ShowXkcd from "./components/show-xkcd.js";

const server = new McpServer(
{ name: "xkcd-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(ShowXkcd);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("XKCD MCP Server running on stdio");
}

main().catch(console.error);
