import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import CheckPasswordStrength from "./components/check-password-strength.js";

const server = new McpServer(
{ name: "password-strength-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(CheckPasswordStrength);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Password Strength MCP Server running on stdio");
}

main().catch(console.error);
