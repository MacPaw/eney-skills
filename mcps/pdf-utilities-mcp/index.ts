import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@macpaw/eney-api";
import ImagesToPdf from "./components/images-to-pdf.js";
import SplitPages from "./components/split-pages.js";

const server = new McpServer(
  {
    name: "pdf-utilities-mcp",
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

uixServer.registerWidget(ImagesToPdf);
uixServer.registerWidget(SplitPages);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("PDF Utilities MCP Server running on stdio");
}

main().catch(console.error);
