import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import CsvToMarkdownTable from "./components/csv-to-markdown-table.js";

const server = new McpServer(
{ name: "markdown-table-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(CsvToMarkdownTable);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Markdown Table MCP Server running on stdio");
}

main().catch(console.error);
