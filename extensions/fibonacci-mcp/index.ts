import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import FibonacciWidget from "./components/fibonacci.js";

const server = new McpServer(
  { name: "fibonacci-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(FibonacciWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Fibonacci MCP Server running on stdio");
}

main().catch(console.error);
