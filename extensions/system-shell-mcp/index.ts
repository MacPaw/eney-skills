import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import RunCommand from "./components/run-command.js";

const server = new McpServer(
{ name: "system-shell-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(RunCommand);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("System Shell MCP Server running on stdio");
}

main().catch(console.error);
