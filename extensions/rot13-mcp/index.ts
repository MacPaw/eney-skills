import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import Rot13Widget from "./components/rot13_cipher.js";

const server = new McpServer(
  { name: "rot13-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(Rot13Widget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("ROT13 Cipher MCP Server running on stdio");
}

main().catch(console.error);
