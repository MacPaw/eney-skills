import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import RollDiceWidget from "./components/roll_dice.js";

const server = new McpServer(
  { name: "dice-roll-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(RollDiceWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Dice Roller MCP Server running on stdio");
}

main().catch(console.error);
