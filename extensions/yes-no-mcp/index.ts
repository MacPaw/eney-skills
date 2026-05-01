import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import YesNoWidget from "./components/yes_no_oracle.js";

const server = new McpServer(
  { name: "yes-no-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(YesNoWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Yes / No Oracle MCP Server running on stdio");
}

main().catch(console.error);
