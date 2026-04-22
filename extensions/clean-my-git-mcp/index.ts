import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import CleanMyGitWidget from "./components/clean-my-git.js";

const server = new McpServer(
  {
    name: "clean-my-git-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      logging: {},
      resources: {},
    },
  },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(CleanMyGitWidget);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Clean My Git MCP Server running on stdio");
}

main().catch(console.error);
