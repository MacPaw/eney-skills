import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import EvaluateExpression from "./components/evaluate-expression.js";

const server = new McpServer(
{ name: "calculator-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(EvaluateExpression);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Calculator MCP Server running on stdio");
}

main().catch(console.error);
