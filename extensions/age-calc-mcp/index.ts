import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import CalculateAge from "./components/calculate-age.js";

const server = new McpServer(
{ name: "age-calc-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(CalculateAge);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Age Calculator MCP Server running on stdio");
}

main().catch(console.error);
