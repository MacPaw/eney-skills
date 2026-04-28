import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import GoogleDriveFiles from "./components/google-drive-files.js";
// import SpotifyNowPlaying from "./components/spotify-now-playing.js";

const server = new McpServer(
  {
    name: "oauth-test-mcp",
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

uixServer.registerWidget(GoogleDriveFiles);
// uixServer.registerWidget(SpotifyNowPlaying);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("OAuth Test MCP Server running on stdio");
}

main().catch(console.error);
