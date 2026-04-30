import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import GenerateAsciiArt from "./components/generate-ascii-art.js";

const server = new McpServer(
{ name: "ascii-art-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(GenerateAsciiArt);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("ASCII Art MCP Server running on stdio");
}

main().catch(console.error);
