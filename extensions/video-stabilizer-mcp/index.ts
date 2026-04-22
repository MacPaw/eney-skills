import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import StabilizeVideo from "./components/stabilize-video.js";

const server = new McpServer(
{ name: "video-stabilizer-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(StabilizeVideo);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Video Stabilizer MCP Server running on stdio");
}

main().catch(console.error);
