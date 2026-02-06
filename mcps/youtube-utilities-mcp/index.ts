import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@macpaw/eney-api";
import GetVideoSubtitles from "./components/get-video-subtitles.js";

const server = new McpServer(
  {
    name: "youtube-utilities-mcp",
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

uixServer.registerWidget(GetVideoSubtitles);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Youtube Utilities MCP Server running on stdio");
}

main().catch(console.error);
