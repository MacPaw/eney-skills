import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import TriviaWidget from "./components/get_trivia_question.js";

const server = new McpServer(
  { name: "trivia-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(TriviaWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Trivia MCP Server running on stdio");
}

main().catch(console.error);
