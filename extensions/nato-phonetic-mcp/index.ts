import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import SpellNato from "./components/spell-nato.js";

const server = new McpServer(
{ name: "nato-phonetic-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(SpellNato);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("NATO Phonetic MCP Server running on stdio");
}

main().catch(console.error);
