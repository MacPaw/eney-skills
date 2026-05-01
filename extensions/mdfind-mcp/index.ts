import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import MdfindWidget from "./components/spotlight_search.js";

const server = new McpServer(
  { name: "mdfind-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(MdfindWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Spotlight Search MCP Server running on stdio");
}

main().catch(console.error);
