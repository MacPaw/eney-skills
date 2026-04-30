import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import ConvertRoman from "./components/convert-roman.js";

const server = new McpServer(
{ name: "roman-numerals-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(ConvertRoman);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Roman Numerals MCP Server running on stdio");
}

main().catch(console.error);
