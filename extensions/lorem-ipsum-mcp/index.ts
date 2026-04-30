import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import GenerateLoremIpsum from "./components/generate-lorem-ipsum.js";

const server = new McpServer(
{ name: "lorem-ipsum-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(GenerateLoremIpsum);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Lorem Ipsum MCP Server running on stdio");
}

main().catch(console.error);
