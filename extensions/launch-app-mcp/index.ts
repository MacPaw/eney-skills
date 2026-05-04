import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import LaunchApp from "./components/launch-app.js";

const server = new McpServer(
{ name: "launch-app-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(LaunchApp);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Launch App MCP Server running on stdio");
}

main().catch(console.error);
