import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import CheckPasswordPwned from "./components/check-password-pwned.js";

const server = new McpServer(
{ name: "password-pwned-mcp", version: "1.0.0" },
{ capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(CheckPasswordPwned);

async function main() {
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Password Pwned MCP Server running on stdio");
}

main().catch(console.error);
