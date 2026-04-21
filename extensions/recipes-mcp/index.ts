import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import ShowRecipes from "./components/show-recipes.js";

const server = new McpServer(
{ name: "recipes-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(ShowRecipes);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Recipes MCP Server running on stdio");
}

main().catch(console.error);
