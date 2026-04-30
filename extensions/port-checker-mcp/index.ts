import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import CheckPort from "./components/check-port.js";

const server = new McpServer(
{ name: "port-checker-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(CheckPort);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Port Checker MCP Server running on stdio");
}

main().catch(console.error);
