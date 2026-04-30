import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import DadJokeWidgetDef from "./components/get_dad_joke.js";

const server = new McpServer(
  { name: "dad-joke-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(DadJokeWidgetDef);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Dad Joke MCP Server running on stdio");
}

main().catch(console.error);
