import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import EncodeBase64 from "./components/encode-base64.js";
import DecodeBase64 from "./components/decode-base64.js";

const server = new McpServer(
  { name: "base64-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(EncodeBase64);
uixServer.registerWidget(DecodeBase64);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Base64 MCP Server running on stdio");
}

main().catch(console.error);
