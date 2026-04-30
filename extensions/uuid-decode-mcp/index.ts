import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import DecodeUuid from "./components/decode-uuid.js";

const server = new McpServer(
{ name: "uuid-decode-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(DecodeUuid);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("UUID Decoder MCP Server running on stdio");
}

main().catch(console.error);
