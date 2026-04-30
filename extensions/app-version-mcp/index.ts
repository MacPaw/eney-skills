import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import ShowAppVersion from "./components/show-app-version.js";

const server = new McpServer(
{ name: "app-version-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(ShowAppVersion);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("App Version MCP Server running on stdio");
}

main().catch(console.error);
