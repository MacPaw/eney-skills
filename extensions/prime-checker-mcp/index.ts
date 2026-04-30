import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import PrimeCheckerWidget from "./components/check_prime.js";

const server = new McpServer(
  { name: "prime-checker-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(PrimeCheckerWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Prime Checker MCP Server running on stdio");
}

main().catch(console.error);
