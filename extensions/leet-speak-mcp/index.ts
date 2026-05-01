import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import LeetSpeakWidget from "./components/convert_leet.js";

const server = new McpServer(
  { name: "leet-speak-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(LeetSpeakWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Leet Speak MCP Server running on stdio");
}

main().catch(console.error);
