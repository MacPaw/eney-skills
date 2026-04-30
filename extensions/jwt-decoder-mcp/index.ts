import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import DecodeJwt from "./components/decode-jwt.js";

const server = new McpServer(
{ name: "jwt-decoder-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(DecodeJwt);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("JWT Decoder MCP Server running on stdio");
}

main().catch(console.error);
