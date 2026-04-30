import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import AdviceSlipWidget from "./components/get_advice.js";

const server = new McpServer(
  { name: "advice-slip-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(AdviceSlipWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Advice Slip MCP Server running on stdio");
}

main().catch(console.error);
