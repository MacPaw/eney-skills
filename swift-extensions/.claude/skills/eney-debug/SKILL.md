---
name: eney-debug
description: Build a Swift MCP skill, install it into Eney via uix-cli, launch it via deeplink, and iterate on issues with the user.
metadata:
  author: macpaw
  version: "1.0"
---

# Debug a Swift MCP Skill

Build Swift MCP extensions, install locally, launch in Eney, and iterate based on user feedback.

## Step 1: Identify the Target

Determine which MCP server target to debug — ask the user or infer from the current directory. Check it exists in `Package.swift`:

```bash
grep -A2 'executableTarget' Package.swift
```

## Step 2: Build

```bash
swift build --target <target-name>
```

Fix any compiler errors before proceeding.

## Step 3: Install with uix-cli

Use the `install` command from the uix-cli to deploy the built binary and register tools with Eney:

```bash
swift run uix-cli install <server-name> \
  --binary .build/debug/<target-name> \
  --tools <widget-name-1> <widget-name-2> \
  --descriptions "Description for widget 1" "Description for widget 2" \
  --version "1.0.0" \
  --author "macpaw" \
  --server-description "Short server description"
```

This does three things:

1. Creates tool definition JSONs in `~/.eney/tools/<widget-name>.json` so Eney discovers the tools locally
2. Copies the compiled binary to:

   ```
   ~/Library/Application Support/com.macpaw.assistant-macos.client-setapp/MCP/<server-name>/mcp-server
   ```

3. Generates a `manifest.json` in the same directory describing the server

## Step 4: Launch in Eney

Open the widget directly in Eney using a deeplink:

```bash
open "eney://run?manifestID=eney_core&commandID=<tool_id>"
```

Where `<tool_id>` is the widget name with hyphens replaced by underscores (e.g., `new-password` → `new_password`). This matches the `id` field in the generated `~/.eney/tools/<widget-name>.json`.

## Step 5: Iterate with User

After launching, ask the user:

1. **Did the tool open correctly?** — if not, check the build output and manifest
2. **Does the UI render as expected?** — if not, review the widget code
3. **Do the actions work?** — test submit, copy, etc.
4. **Any changes needed?** — gather feedback and apply fixes

After each code change, rebuild and reinstall:

```bash
swift build --target <target-name> && swift run uix-cli install <server-name> \
  --binary .build/debug/<target-name> \
  --tools <widget-name> \
  --descriptions "Widget description"
```

Then re-launch with the deeplink to test:

```bash
open "eney://run?manifestID=eney_core&commandID=<tool_id>"
```

Repeat until the user is satisfied.

## Step 6: Inspect Deployed Output

If the tool doesn't load, verify it was deployed correctly:

```bash
ls -la "$HOME/Library/Application Support/com.macpaw.assistant-macos.client-setapp/MCP/<server-name>/"
```

Expected contents: `mcp-server` (binary), `manifest.json`

Also check that tool definitions were generated:

```bash
ls -la ~/.eney/tools/
```

Expected: one `<widget-name>.json` file per tool in the server.

Verify the binary runs:

```bash
.build/debug/<target-name>
```

It should start and wait for stdio input (MCP protocol).

## Common Issues

| Problem                     | Cause                                          | Fix                                                                |
| --------------------------- | ---------------------------------------------- | ------------------------------------------------------------------ |
| Build fails                 | Swift compiler errors                          | Run `swift build --target <name>` and fix errors                   |
| Binary not found            | Wrong target name or build config              | Check `.build/debug/` for the binary; verify target in Package.swift |
| Widget not rendering        | Using wrong UIX components                     | Use only `Form`, `Paper`, `ActionPanel`, etc. from `UIX` module    |
| Props not received from LLM | Missing `.describe()` or schema fields         | Ensure `InputSchema.Field` has correct `name`, `type`, `description` |
| defineWidget error          | Missing required fields                        | Ensure `name`, `description`, `schema`, `factory` are all provided |
| Widget not registered       | Missing `uix.register()` in main.swift         | Import and register the widget definition                          |
| Deeplink doesn't open tool  | Wrong `commandID`                              | Use the widget name with hyphens → underscores                     |
| Tool not visible in Eney    | Missing tool JSON in ~/.eney/tools/            | Re-run `swift run uix-cli install` with `--tools` flag             |
| Install says binary missing | Relative path issue                            | Use `--binary .build/debug/<target>` from the package root         |

## Debugging Checklist

- [ ] Target exists in `Package.swift` as `executableTarget` with `UIX` and `UIXMCP` dependencies
- [ ] `main.swift` creates `Server`, `UIXToolProvider`, registers widgets, and starts transport
- [ ] Each widget uses `defineWidget(name:description:schema:factory:)`
- [ ] `InputSchema.Field` has correct `name`, `type`, and `description` for each field
- [ ] `swift build --target <name>` passes
- [ ] `swift run uix-cli install` deploys binary and creates tool JSONs
- [ ] Tool JSONs generated in `~/.eney/tools/`
- [ ] Deeplink opens the widget in Eney
- [ ] UI renders correctly
- [ ] Actions work as expected
