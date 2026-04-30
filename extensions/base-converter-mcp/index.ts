import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import ConvertBase from "./components/convert-base.js";

const server = new McpServer(
{ name: "base-converter-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(ConvertBase);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Number Base Converter MCP Server running on stdio");
}

main().catch(console.error);
