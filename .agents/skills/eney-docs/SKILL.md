---
name: eney-docs
description: Reference documentation for Eney UIX widgets and UI generation. Covers Form, Paper, Actions, and all components for building native macOS UIs in MCP extensions.
metadata:
  author: macpaw
  version: "2.0"
---

# Eney UIX and Widget Documentation

Reference for building Eney MCP skill UIs.

## Architecture

Eney widgets are a JSX-based interface for building native macOS UI. The rendering pipeline:

```
JSX Component → JSON tree → Native Swift UI
```

You write React components using widget primitives from `@eney/api`. The runtime serializes the component tree to JSON, and the Eney macOS app renders native views.

## MCP Extension Structure

Each MCP is a standalone Node.js server communicating over stdio:

```
mcps/<mcp-name>/
├── manifest.json          # MCP metadata (manifest_version: "0.3")
├── package.json           # Dependencies including @modelcontextprotocol/sdk
├── tsconfig.json          # TypeScript config
├── index.ts               # Server entry — McpServer + setupUIXForMCP
└── components/
    └── <widget-name>.tsx  # Widget using defineWidget()
```

### Key APIs

```tsx
// index.ts — Server setup
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupUIXForMCP } from "@eney/api";

const server = new McpServer(
  { name: "<mcp-name>", version: "1.0.0" },
  { capabilities: { logging: {}, resources: {} } },
);
const uixServer = setupUIXForMCP(server);
uixServer.registerWidget(MyWidget);

// components/<widget-name>.tsx — Widget definition
import { defineWidget } from "@eney/api";

const MyWidgetDef = defineWidget({
  name: "<widget-name>",
  description: "<description for LLM>",
  schema, // Zod schema with .describe() on each field
  component: MyWidget,
});

export default MyWidgetDef;
```

## Import

```tsx
import {
  Form,
  Paper,
  Action,
  ActionPanel,
  Files,
  CardHeader,
  defineWidget,
} from "@eney/api";
```

## Widgets Reference

For full documentation, read the files in `docs/widgets/`:

- `docs/widgets/index.mdx` — overview, rendering pipeline, full example
- `docs/widgets/form.mdx` — Form container
- `docs/widgets/form-fields.mdx` — all form field types
- `docs/widgets/actions.mdx` — action buttons
- `docs/widgets/action-panel.mdx` — action layout
- `docs/widgets/paper.mdx` — markdown display
- `docs/widgets/card-header.mdx` — form header
- `docs/widgets/files.mdx` — file list display

### Form

Container for form fields.

```tsx
<Form
  header={<CardHeader title="Title" />}
  actions={<ActionPanel>...</ActionPanel>}
>
  {/* form fields */}
</Form>
```

Props: `children`, `actions` (ReactNode), `header` (ReactNode)

### Form Fields

| Field                 | Key Props                                                      | Notes                               |
| --------------------- | -------------------------------------------------------------- | ----------------------------------- |
| `Form.TextField`      | `name`, `value`, `onChange`, `label`, `isCopyable`, `$context` | Single-line text                    |
| `Form.PasswordField`  | `name`, `value`, `onChange`, `label`                           | Masked input                        |
| `Form.NumberField`    | `name`, `value`, `onChange`, `label`, `min`, `max`             | Numeric input                       |
| `Form.Checkbox`       | `name`, `checked`, `onChange`, `label`, `variant`              | `"checkbox"` or `"switch"`          |
| `Form.Dropdown`       | `name`, `value`, `onChange`, `label`, `searchable`             | Children: `Form.Dropdown.Item`      |
| `Form.DatePicker`     | `name`, `value`, `onChange`, `label`, `type`                   | `"date"`, `"time"`, or `"datetime"` |
| `Form.FilePicker`     | `name`, `value`, `onChange`, `label`, `accept`, `multiple`     | File selection dialog               |
| `Form.RichTextEditor` | `value`, `onChange`, `isInitiallyFocused`                      | Rich text area                      |

### Actions

| Action                   | Key Props                                               | Notes                  |
| ------------------------ | ------------------------------------------------------- | ---------------------- |
| `Action`                 | `title`, `onAction`, `style`, `isLoading`, `isDisabled` | Generic button         |
| `Action.SubmitForm`      | `title`, `onSubmit`, `style`, `isLoading`, `isDisabled` | Form submit            |
| `Action.CopyToClipboard` | `content`, `title`                                      | Copy text to clipboard |
| `Action.ShowInFinder`    | `path`, `title`                                         | Reveal file in Finder  |

### ActionPanel

```tsx
<ActionPanel layout="row">
  {" "}
  {/* or "column" (default) */}
  <Action.SubmitForm title="Save" onSubmit={fn} style="primary" />
  <Action title="Cancel" onAction={fn} />
</ActionPanel>
```

### Paper

Displays rendered markdown content.

```tsx
<Paper markdown="Hello **world**" isScrollable $context />
<Paper markdown={result} actions={<ActionPanel><Action.CopyToClipboard content={result} /></ActionPanel>} />
```

### CardHeader

```tsx
<CardHeader title="Settings" iconBundleId="gear" />
```

### Files

```tsx
<Files>
  <Files.Item path="/path/to/file.pdf" />
</Files>
```

## The `$context` Prop

When `$context={true}` on a widget, its content is exposed to the AI as conversation context — the model can read and reference the displayed values.

```tsx
<Paper markdown={summary} $context />
<Form.TextField name="url" value={url} onChange={setUrl} $context />
```

## Common Patterns

### Success State

Swap UI after a successful operation:

```tsx
if (status === "success") {
  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Done" />
        </ActionPanel>
      }
    >
      <Paper markdown="Done!" $context />
    </Form>
  );
}
return <Form actions={actions}>{/* fields */}</Form>;
```

### Loading State

```tsx
<Action.SubmitForm
  title={isLoading ? "Saving..." : "Save"}
  onSubmit={onSubmit}
  style="primary"
  isLoading={isLoading}
  isDisabled={!isValid}
/>
```

### Error Display

```tsx
{
  error && <Paper markdown={`Error: ${error}`} />;
}
```

## Real MCP Examples

Study these in the repo for real-world patterns:

| MCP                            | Highlights                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| `mcps/security-utilities-mcp/` | NumberField, Checkbox switches, useEffect auto-generate, `isCopyable`                |
| `mcps/notes-utilities-mcp/`    | Dropdown with dynamic items, RichTextEditor, external helper scripts, loading states |
| `mcps/pdf-utilities-mcp/`      | FilePicker usage                                                                     |
| `mcps/send-mail-mcp/`          | Email sending with multiple form fields                                              |
| `mcps/image-utilities-mcp/`    | Image processing patterns                                                            |

## CLI Commands

| Command                    | Purpose                              |
| -------------------------- | ------------------------------------ |
| `node cli/main.ts dev-mcp` | Watch + compile + deploy MCP to Eney |
| `node cli/main.ts dev`     | Watch + bundle JSX extension to Eney |
| `node cli/main.ts bundle`  | One-time bundle (extensions)         |
