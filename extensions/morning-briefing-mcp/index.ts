import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import MorningBriefing from "./components/morning-briefing.js";

const server = new McpServer(
{ name: "morning-briefing-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(MorningBriefing);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Morning Briefing MCP Server running on stdio");
}

main().catch(console.error);
