import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import GoogleWorkspace from "./components/google-workspace.js";

const server = new McpServer(
{ name: "gws-example-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(GoogleWorkspace);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Google Workspace Example MCP Server running on stdio");
}

main().catch(console.error);
