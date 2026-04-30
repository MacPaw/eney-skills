import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import SearchHomebrew from "./components/search-homebrew.js";
import ListInstalled from "./components/list-installed.js";

const server = new McpServer(
  { name: "homebrew-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(SearchHomebrew);
uixServer.registerWidget(ListInstalled);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Homebrew MCP Server running on stdio");
}

main().catch(console.error);
