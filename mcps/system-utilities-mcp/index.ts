import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@macpaw/eney-api";
import GetRunningProcessesList from "./components/get-running-processes-list.js";
import GetSystemInfo from "./components/get-system-info.js";
import HowLongUntil from "./components/how-long-until.js";

const server = new McpServer(
  {
    name: "system-utilities-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      logging: {},
      resources: {},
    },
  },
);

const uixServer = setupUIXForMCP(server);

uixServer.registerWidget(GetRunningProcessesList);
uixServer.registerWidget(GetSystemInfo);
uixServer.registerWidget(HowLongUntil);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("System Utilities MCP Server running on stdio");
}

main().catch(console.error);
