import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import DogImageWidget from "./components/get_dog_image.js";

const server = new McpServer(
  { name: "dog-image-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(DogImageWidget);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Dog Image MCP Server running on stdio");
}

main().catch(console.error);
