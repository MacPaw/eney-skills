import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import AddEvent from "./components/add-event.js";
import ListTodaysEvents from "./components/list-todays-events.js";

const server = new McpServer(
  { name: "apple-calendar-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(AddEvent);
uixServer.registerWidget(ListTodaysEvents);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Apple Calendar MCP Server running on stdio");
}

main().catch(console.error);
