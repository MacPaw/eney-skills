import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import GithubRepoWidget from "./components/get_github_repo.js";

const server = new McpServer(
  { name: "github-repo-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(GithubRepoWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("GitHub Repo MCP Server running on stdio");
}

main().catch(console.error);
