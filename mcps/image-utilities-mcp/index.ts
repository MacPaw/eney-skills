import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@macpaw/eney-api";
import ImageConverter from "./components/image-converter.js";
import ImageOptimizer from "./components/image-optimizer.js";

const server = new McpServer(
  {
    name: "image-utilities-mcp",
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

uixServer.registerWidget(ImageConverter);
uixServer.registerWidget(ImageOptimizer);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Image Utilities MCP Server running on stdio");
}

main().catch(console.error);
