import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import GitignoreWidget from "./components/make_gitignore.js";

const server = new McpServer(
  { name: "gitignore-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(GitignoreWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Gitignore MCP Server running on stdio");
}

main().catch(console.error);
