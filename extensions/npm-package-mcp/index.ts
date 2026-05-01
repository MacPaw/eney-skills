import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import NpmPackageWidget from "./components/get_npm_package.js";

const server = new McpServer(
  { name: "npm-package-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(NpmPackageWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("NPM Package MCP Server running on stdio");
}

main().catch(console.error);
