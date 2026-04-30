import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import ConvertHtml from "./components/convert-html.js";

const server = new McpServer(
{ name: "html-to-markdown-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(ConvertHtml);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("HTML to Markdown MCP Server running on stdio");
}

main().catch(console.error);
