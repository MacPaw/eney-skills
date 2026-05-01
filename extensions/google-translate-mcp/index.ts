import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import TranslateWidget from "./components/translate_text.js";

const server = new McpServer(
  { name: "google-translate-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(TranslateWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Translate MCP Server running on stdio");
}

main().catch(console.error);
