import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import ChangeTone from "./components/change-tone.js";

const server = new McpServer(
{ name: "tone-changer-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(ChangeTone);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Tone Changer MCP Server running on stdio");
}

main().catch(console.error);
