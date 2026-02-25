---
name: eney-create
description: Create a new Eney MCP skill — scaffold the MCP server, implement widget components with Eney UIX, and verify it compiles.
metadata:
  author: macpaw
  version: "2.0"
---

# Create a New Eney MCP Skill

Eney skills are MCP (Model Context Protocol) servers that expose widgets via `@macpaw/eney-api`. Each MCP runs as a standalone Node.js process communicating over stdio.

## Step 1: Gather Requirements

Ask the user for (skip what's already provided):

- **MCP Name** — kebab-case, suffixed with `-mcp` (e.g., `color-converter-mcp`)
- **MCP Description** — what the server does (e.g., "A MCP server for color conversion utilities")
- **Widget Name** — kebab-case (e.g., `convert-color`)
- **Widget Description** — used by LLM to select the tool (e.g., "Convert colors between HEX, RGB, and HSL formats")

## Step 2: Scaffold the MCP

Create the structure manually under `mcps/<mcp-name>/`:

### Directory Structure

```
mcps/<mcp-name>/
├── manifest.json
├── package.json
├── tsconfig.json
├── index.ts
└── components/
    └── <widget-name>.tsx
```

### manifest.json

```json
{
  "manifest_version": "0.3",
  "name": "<mcp-name>",
  "version": "1.0.0",
  "description": "<MCP Description>",
  "author": {
    "name": "<author>"
  },
  "server": {
    "type": "node",
    "entry_point": "index.js",
    "mcp_config": {
      "command": "node",
      "args": ["${__dirname}/index.js"],
      "env": {}
    }
  },
  "license": "MIT"
}
```

### package.json

```json
{
  "name": "<mcp-name>",
  "version": "1.0.0",
  "type": "module",
  "description": "<MCP Description>",
  "main": "index.js",
  "scripts": {
    "start": "tsx index.ts",
    "build": "tsc",
    "postbuild": "npm i --omit=dev && cp manifest.json dist/manifest.json && cp -r node_modules dist/node_modules && npm i",
    "clean": "rm -rf dist",
    "prepack": "npm run clean && npm run build",
    "pack": "mcpb pack dist"
  },
  "dependencies": {
    "@macpaw/eney-api": "^2.5.0-beta.5",
    "@modelcontextprotocol/sdk": "^1.24.3",
    "react": "^18.3.1",
    "zod": "^4.1.13"
  },
  "devDependencies": {
    "@types/react": "^18.3.27",
    "typescript": "^5.9.3"
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "jsx": "react-jsx",
    "strict": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": ".",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "verbatimModuleSyntax": true,
    "types": ["@types/react"]
  },
  "include": ["**/*.ts", "**/*.tsx", "**/*.d.ts"],
  "exclude": ["dist", "node_modules"]
}
```

### index.ts — MCP Server Entry Point

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@macpaw/eney-api";
import MyWidget from "./components/<widget-name>.js";

const server = new McpServer(
  {
    name: "<mcp-name>",
    version: "1.0.0",
  },
  {
    capabilities: {
      logging: {},
      resources: {},
    },
  },
);

const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(MyWidget);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("<MCP Name> running on stdio");
}

main().catch(console.error);
```

### components/<widget-name>.tsx — Widget Component

```typescript
import React, { useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, Form, defineWidget } from "@macpaw/eney-api";

const schema = z.object({
  // Define props with .describe() for LLM context
  // All fields should be .optional()
});

type Props = z.infer<typeof schema>;

function MyWidget(props: Props) {
  // Implement using Eney UIX widgets
  return (
    <Form actions={<ActionPanel><Action.Finalize title="Done" /></ActionPanel>}>
      {/* form fields */}
    </Form>
  );
}

const MyWidgetDef = defineWidget({
  name: "<widget-name>",
  description: "<Widget Description>",
  schema,
  component: MyWidget,
});

export default MyWidgetDef;
```

## Step 3: Install Dependencies

```bash
cd mcps/<mcp-name> && npm install
```

## Step 4: Implement the Widget

Edit `mcps/<mcp-name>/components/<widget-name>.tsx`. For the full widget API, read `docs/widgets/`:

- `docs/widgets/index.mdx` — overview, rendering pipeline, full example
- `docs/widgets/form.mdx` — Form container
- `docs/widgets/form-fields.mdx` — TextField, NumberField, Checkbox, Dropdown, DatePicker, FilePicker, RichTextEditor
- `docs/widgets/actions.mdx` — Action, SubmitForm, CopyToClipboard, ShowInFinder, Finalize
- `docs/widgets/action-panel.mdx` — ActionPanel layout
- `docs/widgets/paper.mdx` — markdown display
- `docs/widgets/card-header.mdx` — form header with icon
- `docs/widgets/files.mdx` — file list display

Key patterns:

- **defineWidget** — wraps the component with `{ name, description, schema, component }` and is the default export
- **registerWidget** — each widget is imported in `index.ts` and registered with `uixServer.registerWidget()`
- **Schema** — `z.object({...})`, every field needs `.describe()`, fields should be `.optional()`
- **$context** — expose widget values to the AI conversation
- **Action.Finalize** — signals completion, closes the widget
- **Success state pattern** — swap UI after successful operations (return different JSX)
- **Business logic** — extract into separate files (`components/utils.ts` or `helpers/`)

### Adding Multiple Widgets

To add more widgets to the same MCP, create additional files in `components/` and register each one in `index.ts`:

```typescript
import WidgetA from "./components/widget-a.js";
import WidgetB from "./components/widget-b.js";

uixServer.registerWidget(WidgetA);
uixServer.registerWidget(WidgetB);
```

## Step 5: Verify

```bash
cd mcps/<mcp-name> && npx tsc --noEmit
```

## Reference: Existing MCPs

Study these in the repo for real-world patterns:

- `mcps/security-utilities-mcp/` — simple form with generation logic
- `mcps/notes-utilities-mcp/` — Apple Notes integration with helpers, dropdowns, loading states
- `mcps/pdf-utilities-mcp/` — file picker usage
- `mcps/send-mail-mcp/` — email sending with multiple fields
- `mcps/image-utilities-mcp/` — image processing patterns
