import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import Pomodoro from "./components/pomodoro.js";

const server = new McpServer(
{ name: "pomodoro-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(Pomodoro);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Pomodoro MCP Server running on stdio");
}

main().catch(console.error);
