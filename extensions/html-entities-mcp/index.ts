import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import EncodeHtmlEntities from "./components/encode-html-entities.js";
import DecodeHtmlEntities from "./components/decode-html-entities.js";

const server = new McpServer(
  { name: "html-entities-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(EncodeHtmlEntities);
uixServer.registerWidget(DecodeHtmlEntities);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("HTML Entities MCP Server running on stdio");
}

main().catch(console.error);
