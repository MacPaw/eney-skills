import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import CalculateTip from "./components/calculate-tip.js";

const server = new McpServer(
{ name: "tip-calc-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(CalculateTip);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Tip Calculator MCP Server running on stdio");
}

main().catch(console.error);
