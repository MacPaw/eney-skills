import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import SayText from "./components/say-text.js";

const server = new McpServer(
{ name: "mac-tts-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(SayText);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Mac Text-to-Speech MCP Server running on stdio");
}

main().catch(console.error);
