import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import HashText from "./components/hash-text.js";

const server = new McpServer(
{ name: "hash-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(HashText);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Hash MCP Server running on stdio");
}

main().catch(console.error);
