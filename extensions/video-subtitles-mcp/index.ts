import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import AddVideoSubtitles from "./components/add-video-subtitles.js";

const server = new McpServer(
{ name: "video-subtitles-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(AddVideoSubtitles);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Video Subtitles MCP Server running on stdio");
}

main().catch(console.error);
