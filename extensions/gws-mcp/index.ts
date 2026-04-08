import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";
import DriveGetFileMetadata from "./components/google-drive/drive-get-file-metadata.js";
import DriveDownloadFile from "./components/google-drive/drive-download-file.js";
import DriveExportFile from "./components/google-drive/drive-export-file.js";
import DriveCopyFile from "./components/google-drive/drive-copy-file.js";
import DriveDeleteFile from "./components/google-drive/drive-delete-file.js";
import MeetCreateSpace from "./components/google-meet/meet-create-space.js";
import MeetSpace from "./components/google-meet/meet-space.js";
import TasksManager from "./components/google-tasks/tasks-manager.js";
import DocsGet from "./components/google-docs/docs-get.js";
import DocsWrite from "./components/google-docs/docs-write.js";
import DocsCreate from "./components/google-docs/docs-create.js";
import DocsCreateFromTemplate from "./components/google-docs/docs-create-from-template.js";
import SheetsCreate from "./components/google-sheets/sheets-create.js";

const server = new McpServer(
  { name: "gws-mcp", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(DriveGetFileMetadata);
uixServer.registerWidget(DriveDownloadFile);
uixServer.registerWidget(DriveExportFile);
uixServer.registerWidget(DriveCopyFile);
uixServer.registerWidget(DriveDeleteFile);
uixServer.registerWidget(MeetCreateSpace);
uixServer.registerWidget(MeetSpace);
uixServer.registerWidget(TasksManager);
uixServer.registerWidget(DocsGet);
uixServer.registerWidget(DocsWrite);
uixServer.registerWidget(DocsCreate);
uixServer.registerWidget(DocsCreateFromTemplate);
uixServer.registerWidget(SheetsCreate);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Google Workspace Example MCP Server running on stdio");
}

main().catch(console.error);
