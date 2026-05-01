import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import WordToolsWidget from "./components/find_words.js";

const server = new McpServer(
  { name: "datamuse-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(WordToolsWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Word Tools MCP Server running on stdio");
}

main().catch(console.error);
