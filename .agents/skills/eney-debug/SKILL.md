---
name: eney-debug
description: Build an Eney MCP skill, deploy it locally, launch it in the Eney app via deeplink, and iterate on issues with the user.
metadata:
  author: macpaw
  version: "2.0"
---

# Debug an Eney MCP Skill

Build MCP extensions, deploy locally, launch in Eney, and iterate based on user feedback.

## Step 1: Identify the MCP

Determine which MCP to debug — ask the user or infer from the current directory. Read its manifest:

```bash
cat mcps/<mcp-name>/manifest.json
```

## Step 2: Build

```bash
cd mcps/<mcp-name> && npm run build
```

Fix any TypeScript errors before proceeding.

## Step 3: Run Dev Mode

The CLI `dev` command watches for changes, compiles with tsc, and deploys to the Eney MCP folder:

```bash
cd mcps/<mcp-name> && node ../../cli/main.ts dev
```

This does three things on every build:

1. Compiles TypeScript and deploys the output (compiled JS, manifest.json, node_modules) to:

   ```
   ~/Library/Application Support/com.macpaw.assistant-macos.client-setapp/MCP/<mcp-name>/
   ```

2. Extracts tools from the MCP server via the MCP protocol

3. Generates tool definition JSONs in `~/.eney/tools/<widget-name>.json` so Eney discovers the tools locally without needing backend publishing

It watches for file changes and rebuilds automatically (ignores `node_modules/`, `dist/`, and `package-lock.json`).

For a one-time build without watching:

```bash
cd mcps/<mcp-name> && npm run build
```

## Step 4: Launch in Eney

Open the widget directly in Eney using a deeplink:

```bash
open "eney://run?manifestID=eney_core&commandID=<tool_id>"
```

Where `<tool_id>` is the snake_case `id` from the generated `~/.eney/tools/<tool-name>.json` (e.g., `new_password`, `append_to_note`). This is the widget name with hyphens replaced by underscores.

## Step 5: Iterate with User

After launching, ask the user:

1. **Did the tool open correctly?** — if not, check the build output and manifest
2. **Does the UI render as expected?** — if not, review the widget usage
3. **Do the actions work?** — test submit, copy, etc.
4. **Any changes needed?** — gather feedback and apply fixes

After each code change, the `dev` watcher auto-rebuilds and redeploys. Re-launch with the deeplink to test:

```bash
open "eney://run?manifestID=eney_core&commandID=<tool_id>"
```

Repeat until the user is satisfied.

## Step 6: Inspect Deployed Output

If the tool doesn't load, verify it was deployed correctly:

```bash
ls -la "$HOME/Library/Application Support/com.macpaw.assistant-macos.client-setapp/MCP/<mcp-name>/"
```

Expected contents: `index.js`, `components/`, `manifest.json`, `node_modules/`

Also check that tool definitions were generated:

```bash
ls -la ~/.eney/tools/
```

Expected: one `<widget-name>.json` file per tool in the MCP.

Check the server can start:

```bash
cd mcps/<mcp-name> && npm start
```

It should print a "running on stdio" message to stderr.

## Common Issues

| Problem                     | Cause                                            | Fix                                                                     |
| --------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------- |
| Build fails                 | TypeScript errors                                | Run `npm run build` and fix errors                                      |
| Server won't start          | Missing dependencies                             | Run `npm install` then rebuild                                          |
| Widget not rendering        | Using HTML elements instead of Eney widgets      | Use only `Form`, `Paper`, `ActionPanel`, etc. from `@eney/api`          |
| Props not received from LLM | Missing `.describe()` on Zod schema fields       | Add `.describe("...")` to every field                                   |
| defineWidget error          | Missing required fields                          | Ensure `{ name, description, schema, component }` are all provided      |
| Widget not registered       | Missing `uixServer.registerWidget()` in index.ts | Import and register the widget                                          |
| Import paths wrong          | Missing `.js` extension in imports               | Use `.js` extensions for local imports (e.g., `./components/widget.js`) |
| Deeplink doesn't open tool  | Wrong `commandID`                                | Use the widget `name` from `defineWidget()`, not the manifest name      |
| Tool not visible in Eney    | Missing tool JSON in ~/.eney/tools/              | Run `dev-mcp` — it generates tool definitions automatically             |

## Debugging Checklist

- [ ] `manifest.json` has `manifest_version: "0.3"` and correct `name`/`version`
- [ ] `index.ts` creates McpServer and registers all widgets via `uixServer.registerWidget()`
- [ ] Each component uses `defineWidget({ name, description, schema, component })`
- [ ] Zod schema has `.describe()` on every field
- [ ] Local imports use `.js` extension (TypeScript ESM requirement)
- [ ] `npm run build` passes
- [ ] `dev` deploys to the Eney MCP folder
- [ ] Tool JSONs generated in `~/.eney/tools/`
- [ ] Deeplink opens the widget in Eney
- [ ] UI renders correctly
- [ ] Actions work as expected
