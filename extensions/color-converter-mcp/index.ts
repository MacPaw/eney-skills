import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import ConvertColor from "./components/convert-color.js";

const server = new McpServer(
{ name: "color-converter-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(ConvertColor);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Color Converter MCP Server running on stdio");
}

main().catch(console.error);
