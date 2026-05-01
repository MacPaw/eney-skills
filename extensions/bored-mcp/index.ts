import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import BoredWidget from "./components/suggest_activity.js";

const server = new McpServer(
  { name: "bored-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(BoredWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Bored Activity MCP Server running on stdio");
}

main().catch(console.error);
