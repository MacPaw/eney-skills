import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import InterestCalcWidget from "./components/calculate_interest.js";

const server = new McpServer(
  { name: "interest-calc-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(InterestCalcWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Interest Calculator MCP Server running on stdio");
}

main().catch(console.error);
