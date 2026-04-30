import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import EncodeUrl from "./components/encode-url.js";
import DecodeUrl from "./components/decode-url.js";

const server = new McpServer(
  { name: "url-encoder-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(EncodeUrl);
uixServer.registerWidget(DecodeUrl);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("URL Encoder MCP Server running on stdio");
}

main().catch(console.error);
