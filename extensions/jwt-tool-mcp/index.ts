import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import JwtTool from "./components/jwt-tool.js";

const server = new McpServer(
{ name: "jwt-tool-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(JwtTool);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("JWT Tool MCP Server running on stdio");
}

main().catch(console.error);
