import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import ConvertMarkdown from "./components/convert-markdown.js";

const server = new McpServer(
{ name: "markdown-to-html-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(ConvertMarkdown);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Markdown to HTML MCP Server running on stdio");
}

main().catch(console.error);
