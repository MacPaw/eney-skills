import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import GithubZenWidget from "./components/get_github_zen.js";

const server = new McpServer(
  { name: "github-zen-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(GithubZenWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("GitHub Zen MCP Server running on stdio");
}

main().catch(console.error);
