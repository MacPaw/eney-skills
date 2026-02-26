---
name: eney-create
description: Create a new Eney MCP skill using the CLI scaffolding tool, then implement widget components with Eney UIX.
metadata:
  author: macpaw
  version: "2.0"
---

# Create a New Eney MCP Skill

Eney skills are MCP (Model Context Protocol) servers that expose widgets via `@macpaw/eney-api`. Each MCP runs as a standalone Node.js process communicating over stdio.

## Step 1: Gather Requirements

Ask the user for (skip what's already provided):

- **MCP ID** — kebab-case, suffixed with `-mcp` (e.g., `color-converter-mcp`)
- **MCP Title** — display name (e.g., "Color Converter")
- **Tool Name** — kebab-case (e.g., `convert-color`)
- **Tool Title** — shown in Eney UI (e.g., "Convert Color")
- **Tool Description** — used by LLM to select the tool (e.g., "Convert colors between HEX, RGB, and HSL formats")

## Step 2: Create a Feature Branch

Start from an up-to-date `main`:

```bash
git checkout main && git pull
git checkout -b feat/<mcp-id>
```

## Step 3: Scaffold with CLI

Run from the repo root:

```bash
node cli/main.ts create \
  --id <mcp-id> \
  --mcp-title "<MCP Title>" \
  --tool-name <tool-name> \
  --tool-description "<Tool Description>" \
  --tool-title "<Tool Title>" \
  -o ./mcps
```

This creates the full MCP structure under `mcps/<mcp-id>/`:

```
mcps/<mcp-id>/
├── manifest.json          # MCP metadata (manifest_version: "0.3")
├── package.json           # Dependencies including @modelcontextprotocol/sdk
├── tsconfig.json          # TypeScript config
├── index.ts               # Server entry — McpServer + setupUIXForMCP + registerWidget
└── components/
    └── <tool-name>.tsx    # Widget using defineWidget()
```

Dependencies are installed automatically by the CLI.

## Step 4: Implement the Widget

Edit `mcps/<mcp-id>/components/<tool-name>.tsx`. For the full widget API, read `docs/widgets/`:

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
cd mcps/<mcp-id> && npx tsc --noEmit
```

## Reference: Existing MCPs

Study these in the repo for real-world patterns:

- `mcps/security-utilities-mcp/` — simple form with generation logic
- `mcps/notes-utilities-mcp/` — Apple Notes integration with helpers, dropdowns, loading states
- `mcps/pdf-utilities-mcp/` — file picker usage
- `mcps/send-mail-mcp/` — email sending with multiple fields
- `mcps/image-utilities-mcp/` — image processing patterns
