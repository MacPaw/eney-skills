import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import AspectRatioWidget from "./components/compute_aspect_ratio.js";

const server = new McpServer(
  { name: "aspect-ratio-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(AspectRatioWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Aspect Ratio MCP Server running on stdio");
}

main().catch(console.error);
