---
name: eney-create
description: Create a new Eney MCP skill using the CLI scaffolding tool, then implement widget components with Eney UIX.
metadata:
  author: macpaw
  version: "3.0"
---

# Create a New Eney MCP Skill

Eney skills are MCP (Model Context Protocol) servers that expose widgets via `@eney/api`. Each MCP runs as a standalone Node.js process communicating over stdio.

## Step 0: Setup CLI

Make sure you have the CLI installed and linked globally:

```bash
npm run setup
```

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
eney-skills-cli create \
  --id <mcp-id> \
  --mcp-title "<MCP Title>" \
  --tool-name <tool-name> \
  --tool-description "<Tool Description>" \
  --tool-title "<Tool Title>" \
  -o ./extensions
```

> If `eney-skills-cli` is not found, run `cd cli && npm link` first.

This creates the full MCP structure under `extensions/<mcp-id>/` and installs base dependencies.

## Step 4: Install Additional Dependencies

If the widget needs third-party libraries (e.g., `qrcode`, `sharp`, `crypto-js`), install them in the MCP directory:

```bash
cd extensions/<mcp-id> && npm install <package-name>
```

For packages with TypeScript types, also install the types:

```bash
npm install <package-name> @types/<package-name>
```

## Step 5: Implement the Widget

Edit `extensions/<mcp-id>/components/<tool-name>.tsx`.

### Widget Structure

Every widget follows this pattern:

```tsx
import { useState } from "react";
import { z } from "zod";
import { Action, ActionPanel, Form, Paper, CardHeader, defineWidget, useCloseWidget } from "@macpaw/eney-api";

// 1. Schema — all fields need .describe() and should be .optional()
const schema = z.object({
  input: z.string().optional().describe("The input value."),
});

type Props = z.infer<typeof schema>;

// 2. Component — uses Form, Paper, ActionPanel primitives (NO HTML elements)
function MyTool(props: Props) {
  const closeWidget = useCloseWidget();
  const [input, setInput] = useState(props.input ?? "");
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit() {
    if (!input.trim()) return;
    setIsLoading(true);
    setError("");
    try {
      const output = await process(input);
      setResult(output);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  }

  function onDone() {
    closeWidget("Done.");
  }

  // Result state — swap UI after operation
  if (result) {
    return (
      <Form
        header={<CardHeader title="My Tool" />}
        actions={
          <ActionPanel layout="row">
            <Action.SubmitForm title="Start Over" onSubmit={() => setResult("")} style="secondary" />
            <Action title="Done" onAction={onDone} style="primary" />
          </ActionPanel>
        }
      >
        <Paper markdown={result} />
        <Form.TextField name="input" label="Input" value={input} onChange={setInput} isCopyable />
      </Form>
    );
  }

  // Input state
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
            isDisabled={!input.trim()}
          />
        </ActionPanel>
      }
    >
      {error && <Paper markdown={`**Error:** ${error}`} />}
      <Form.TextField name="input" label="Input" value={input} onChange={setInput} />
    </Form>
  );
}

// 3. defineWidget — wraps component for registration
const MyToolWidget = defineWidget({
  name: "my-tool",
  description: "Process the provided input",
  schema,
  component: MyTool,
});

export default MyToolWidget;
```

### Critical Rules

- **`onChange` is REQUIRED** on all form fields — even display-only fields need it.
- **`Form.NumberField` value is `number | null`**, not `number`.
- **Use `.js` extensions** for local imports: `import X from "./foo.js"`.
- **No HTML elements** — only Eney primitives (`Form`, `Paper`, `ActionPanel`, `Files`, `CardHeader`).
- **No `<img>` tags** — display images via `<Paper markdown="![alt](dataUrl)" />` or `<Files><Files.Item path="..." /></Files>`.

### Available Form Fields

| Field                 | Required Props                | Optional Props                | Notes                            |
| --------------------- | ----------------------------- | ----------------------------- | -------------------------------- |
| `Form.TextField`      | `name`, `value`, `onChange`   | `label`, `isCopyable`         | Single-line text                 |
| `Form.PasswordField`  | `name`, `value`, `onChange`   | `label`                       | Masked input                     |
| `Form.NumberField`    | `name`, `value`, `onChange`   | `label`, `min`, `max`         | `value` is `number \| null`      |
| `Form.Checkbox`       | `name`, `checked`, `onChange` | `label`, `variant`            | `"checkbox"` or `"switch"`       |
| `Form.Dropdown`       | `name`, `value`, `onChange`   | `label`, `searchable`         | Children: `Form.Dropdown.Item`   |
| `Form.DatePicker`     | `name`, `value`, `onChange`   | `label`, `type`               | `"date"`, `"time"`, `"datetime"` |
| `Form.FilePicker`     | `name`, `value`, `onChange`   | `label`, `accept`, `multiple` | File selection dialog            |
| `Form.RichTextEditor` | `value`, `onChange`           | `isInitiallyFocused`          | Rich text area                   |

### Available Actions

| Action                   | Key Props                                               | Notes                  |
| ------------------------ | ------------------------------------------------------- | ---------------------- |
| `Action`                 | `title`, `onAction`, `style`, `isLoading`, `isDisabled` | Generic button         |
| `Action.SubmitForm`      | `title`, `onSubmit`, `style`, `isLoading`, `isDisabled` | Form submit            |
| `Action.CopyToClipboard` | `content`, `title`                                      | Copy text to clipboard |
| `Action.ShowInFinder`    | `path`, `title`                                         | Reveal file in Finder  |

### Adding Multiple Widgets

Create additional files in `components/` and register each in `index.ts`:

```typescript
import WidgetA from "./components/widget-a.js";
import WidgetB from "./components/widget-b.js";

uixServer.registerWidget(WidgetA);
uixServer.registerWidget(WidgetB);
```

## Step 6: Verify

```bash
cd extensions/<mcp-id> && npm run build
```

> Always use `npm run build` to verify — never `npx tsc --noEmit` or `npx tsc` directly.

### Common Build Errors

| Error                                                 | Cause                                     | Fix                                                  |
| ----------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------- |
| `Property 'onChange' is missing`                      | `onChange` is required on all form fields | Add `onChange={setter}` even for display-only fields |
| `Type 'number' is not assignable to 'number \| null'` | NumberField value is nullable             | Use `useState<number \| null>(defaultValue)`         |
| `Cannot find module './foo'`                          | Missing `.js` extension in import         | Use `import X from "./foo.js"`                       |

## Step 7: Publish

To publish the extension, create a pull request to `main` with a short description of what the extension does:

```bash
git add extensions/<mcp-id>
git commit -m "feat: add <mcp-id>"
git push -u origin feat/<mcp-id>
gh pr create --title "feat: add <MCP Title>" --body "Short description of the extension."
```
