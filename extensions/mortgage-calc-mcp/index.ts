import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import MortgageCalcWidget from "./components/calculate_mortgage.js";

const server = new McpServer(
  { name: "mortgage-calc-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(MortgageCalcWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Mortgage Calculator MCP Server running on stdio");
}

main().catch(console.error);
