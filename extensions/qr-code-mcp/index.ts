import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import GenerateQrCode from "./components/generate-qr-code.js";

const server = new McpServer(
{ name: "qr-code-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(GenerateQrCode);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("QR Code MCP Server running on stdio");
}

main().catch(console.error);
