---
name: eney-docs
description: Reference documentation for Eney UIX widgets and UI generation. Covers Form, Paper, Actions, and all components for building native macOS UIs in MCP extensions.
metadata:
  author: macpaw
  version: "3.0"
---

# Eney UIX and Widget Documentation

Reference for building Eney MCP skill UIs.

## Architecture

Eney widgets are a JSX-based interface for building native macOS UI. The rendering pipeline:

```
JSX Component → JSON tree → Native Swift UI
```

You write React components using widget primitives from `@eney/api`. The runtime serializes the component tree to JSON, and the Eney macOS app renders native views.

**Important constraints:**

- There is NO DOM. Only Eney primitives (`Form`, `Paper`, `ActionPanel`, etc.) can be used — no `<div>`, `<span>`, `<img>`, or other HTML elements.
- There is NO `Image` component. To display images, use `Paper` with markdown image syntax: `<Paper markdown="![alt](dataUrl)" />` (data URLs work) or use `Files` to display file paths.

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
  useCloseWidget,
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

**`onChange` is REQUIRED on all form input fields.** Even if a field is display-only, you must pass an `onChange` handler.

| Field                 | Required Props                | Optional Props                | Notes                               |
| --------------------- | ----------------------------- | ----------------------------- | ----------------------------------- |
| `Form.TextField`      | `name`, `value`, `onChange`   | `label`, `isCopyable`         | Single-line text                    |
| `Form.PasswordField`  | `name`, `value`, `onChange`   | `label`                       | Masked input                        |
| `Form.NumberField`    | `name`, `value`, `onChange`   | `label`, `min`, `max`         | `value` is `number \| null`         |
| `Form.Checkbox`       | `name`, `checked`, `onChange` | `label`, `variant`            | `"checkbox"` or `"switch"`          |
| `Form.Dropdown`       | `name`, `value`, `onChange`   | `label`, `searchable`         | Children: `Form.Dropdown.Item`      |
| `Form.DatePicker`     | `name`, `value`, `onChange`   | `label`, `type`               | `"date"`, `"time"`, or `"datetime"` |
| `Form.FilePicker`     | `name`, `value`, `onChange`   | `label`, `accept`, `multiple` | File selection dialog               |
| `Form.RichTextEditor` | `value`, `onChange`           | `isInitiallyFocused`          | Rich text area                      |

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
  <Action.SubmitForm title="Save" onSubmit={fn} style="primary" />
  <Action title="Cancel" onAction={fn} />
</ActionPanel>
```

Layout: `"row"` for horizontal, `"column"` (default) for vertical.

### Paper

Displays rendered markdown content. Supports standard markdown including images via `![alt](url)`.

```tsx
<Paper markdown="Hello **world**" isScrollable />
<Paper markdown="Hello **world**" isScrollable />
<Paper markdown={result} actions={<ActionPanel><Action.CopyToClipboard content={result} /></ActionPanel>} />
```

Props: `markdown` (string), `isScrollable` (boolean), `actions` (ReactNode)

### CardHeader

```tsx
<CardHeader title="Settings" iconBundleId="gear" />
```

### Files

Display a list of files with native previews and actions.

```tsx
<Files>
  <Files.Item path="/path/to/file.pdf" />
</Files>
```

## Displaying Images

There is no dedicated Image component. Use one of these approaches:

**Inline image via Paper (data URL):**

```tsx
const dataUrl = "data:image/png;base64,...";
<Paper markdown={`![Description](${dataUrl})`} />;
```

**File-based image via Files:**

```tsx
<Files>
  <Files.Item path="/path/to/image.png" />
</Files>
```

## Common Patterns

### Success State with Result

Swap to a result UI after an operation completes:

```tsx
if (resultPath) {
  return (
    <Form
      actions={
        <ActionPanel layout="row">
          <Action.ShowInFinder style="secondary" path={resultPath} />
          <Action.SubmitForm onSubmit={onDone} title="Done" style="primary" />
        </ActionPanel>
      }
    >
      <Files>
        <Files.Item path={resultPath} />
      </Files>
    </Form>
  );
}
return <Form actions={actions}>{/* input fields */}</Form>;
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
  error && <Paper markdown={`**Error:** ${error}`} />;
}
```

### Auto-Generate with useEffect

Automatically recompute a result when inputs change:

```tsx
useEffect(() => {
  const value = generatePassword({ length, symbols, numbers });
  setPassword(value);
}, [length, symbols, numbers]);
```

### Dropdown with Dynamic Items

```tsx
<Form.Dropdown name="format" value={format} onChange={setFormat} label="Format">
  {formats.map((f) => (
    <Form.Dropdown.Item key={f} title={f.toUpperCase()} value={f} />
  ))}
</Form.Dropdown>
```

## Complete Widget Example

A full widget with form input, async processing, and result display:

```tsx
import { useState } from "react";
import { z } from "zod";
import {
  Action,
  ActionPanel,
  Form,
  Paper,
  CardHeader,
  defineWidget,
  useCloseWidget,
} from "@macpaw/eney-api";

const schema = z.object({
  text: z.string().optional().describe("The input text to process."),
});

type Props = z.infer<typeof schema>;

function MyTool(props: Props) {
  const closeWidget = useCloseWidget();
  const [text, setText] = useState(props.text ?? "");
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit() {
    if (!text.trim()) return;
    setIsLoading(true);
    setError("");
    try {
      const output = await doSomething(text);
      setResult(output);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  }

  function onDone() {
    closeWidget("Done processing.");
  }

  if (result) {
    return (
      <Form
        header={<CardHeader title="My Tool" />}
        actions={
          <ActionPanel layout="row">
            <Action.SubmitForm
              title="Start Over"
              onSubmit={() => setResult("")}
              style="secondary"
            />
            <Action title="Done" onAction={onDone} style="primary" />
          </ActionPanel>
        }
      >
        <Paper markdown={result} />
        <Form.TextField
          name="text"
          label="Input"
          value={text}
          onChange={setText}
          isCopyable
        />
      </Form>
    );
  }

  return (
    <Form
      header={<CardHeader title="My Tool" />}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title={isLoading ? "Processing..." : "Process"}
            onSubmit={onSubmit}
            style="primary"
            isLoading={isLoading}
            isDisabled={!text.trim()}
          />
        </ActionPanel>
      }
    >
      {error && <Paper markdown={`**Error:** ${error}`} />}
      <Form.TextField
        name="text"
        label="Input Text"
        value={text}
        onChange={setText}
      />
    </Form>
  );
}

const MyToolWidget = defineWidget({
  name: "my-tool",
  description: "Process the provided text",
  schema,
  component: MyTool,
});

export default MyToolWidget;
```

## TypeScript Gotchas

- **`onChange` is required** on all form fields — even display-only fields need it.
- **`Form.NumberField` value is `number | null`**, not just `number`.
- **Use `.js` extensions** for all local imports (ESM requirement): `import X from "./foo.js"`.
- **All Zod fields need `.describe()`** and should be `.optional()`.

## CLI Commands

| Command                | Purpose                              |
| ---------------------- | ------------------------------------ |
| `eney-skills-cli dev` | Watch + compile + deploy MCP to Eney |
