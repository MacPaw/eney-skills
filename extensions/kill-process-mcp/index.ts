import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import KillProcessWidget from "./components/kill_process.js";

const server = new McpServer(
  { name: "kill-process-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(KillProcessWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Kill Process MCP Server running on stdio");
}

main().catch(console.error);
