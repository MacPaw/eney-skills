import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import TodayMatches from "./components/today-matches.js";
import LeagueBrowser from "./components/league-browser.js";

const server = new McpServer(
  { name: "football-scores-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(TodayMatches);
uixServer.registerWidget(LeagueBrowser);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Football Scores MCP Server running on stdio");
}

main().catch(console.error);
