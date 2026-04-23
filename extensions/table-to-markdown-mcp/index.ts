import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import TableToMarkdown from "./components/table-to-markdown.js";

const server = new McpServer(
{ name: "table-to-markdown-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(TableToMarkdown);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Table to Markdown MCP Server running on stdio");
}

main().catch(console.error);
