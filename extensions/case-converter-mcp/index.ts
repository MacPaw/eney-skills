import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import ConvertCase from "./components/convert-case.js";

const server = new McpServer(
{ name: "case-converter-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(ConvertCase);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Case Converter MCP Server running on stdio");
}

main().catch(console.error);
