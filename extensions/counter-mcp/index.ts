import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import CounterWidget from "./components/show_counter.js";

const server = new McpServer(
  { name: "counter-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(CounterWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Counter MCP Server running on stdio");
}

main().catch(console.error);
