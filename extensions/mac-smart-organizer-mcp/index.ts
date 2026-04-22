import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import SmartOrganizeDirectory from "./components/smart-organize-directory.js";

const server = new McpServer(
  { name: "mac-smart-organizer-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } }
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(SmartOrganizeDirectory);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Mac Smart Organizer MCP Server running on stdio");
}

main().catch(console.error);
