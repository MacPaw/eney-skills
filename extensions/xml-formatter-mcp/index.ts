import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import FormatXml from "./components/format-xml.js";

const server = new McpServer(
{ name: "xml-formatter-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(FormatXml);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("XML Formatter MCP Server running on stdio");
}

main().catch(console.error);
