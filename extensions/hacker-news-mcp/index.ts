import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import HackerNewsWidget from "./components/show_hacker_news.js";

const server = new McpServer(
  { name: "hacker-news-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(HackerNewsWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Hacker News MCP Server running on stdio");
}

main().catch(console.error);
