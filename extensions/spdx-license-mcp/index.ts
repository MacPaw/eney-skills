import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import SpdxWidget from "./components/lookup_spdx_license.js";

const server = new McpServer(
  { name: "spdx-license-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(SpdxWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("SPDX License MCP Server running on stdio");
}

main().catch(console.error);
