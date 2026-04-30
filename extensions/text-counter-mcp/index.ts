import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import CountText from "./components/count-text.js";

const server = new McpServer(
{ name: "text-counter-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(CountText);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Text Counter MCP Server running on stdio");
}

main().catch(console.error);
