import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import BirthdayCountdownWidget from "./components/birthday_countdown.js";

const server = new McpServer(
  { name: "birthday-countdown-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(BirthdayCountdownWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Birthday Countdown MCP Server running on stdio");
}

main().catch(console.error);
