---
name: eney-test
description: Add and run tests for an Eney MCP skill using the UIX test session API and node:test.
metadata:
  author: macpaw
  version: "1.0"
---

# Test an Eney MCP Skill

Add widget and unit tests to an MCP extension using `@eney/api/testing` and `node:test`.

## Step 1: Identify the MCP

Determine which MCP to test — ask the user or infer from the current directory. Read its components:

```bash
ls mcps/<mcp-name>/components/
```

## Step 2: Check Test Setup

Newly scaffolded MCPs already include the test script, `@types/node` in tsconfig, and a `tests/` directory. Verify this before proceeding — only add missing pieces:

- **`package.json`**: should have `"test": "npx tsx --test tests/*.test.ts"` in scripts. Add if missing.
- **`tsconfig.json`**: should have `"types": ["@types/react", "@types/node"]` in compilerOptions. Add if missing.
- **`@types/node`**: should be in devDependencies. Install if missing: `npm install --save-dev @types/node`

## Step 3: Write Tests

Create test files in a `tests/` directory inside the MCP.

### Widget Tests (using `createUIXTestSession`)

Use `createUIXTestSession` from `@eney/api/testing` to mount a widget definition and interact with it:

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import MyWidget from "../components/my-widget.js";

describe("MyWidget", () => {
  it("renders with default props", async () => {
    const session = await createUIXTestSession(MyWidget);
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });
});
```

### `createUIXTestSession` API

`createUIXTestSession(widgetComponent, props?)` returns a `UIXTestSession`:

| Method                             | Description                                                         |
| ---------------------------------- | ------------------------------------------------------------------- |
| `getState()`                       | Returns the full widget tree (`Widget`)                             |
| `getSimplifiedState()`             | Returns a simplified tree (type, id, flat props, children)          |
| `findWidget(query)`                | Find first widget matching `{ type?, name?, label?, title?, $id? }` |
| `findAllWidgets(query)`            | Find all widgets matching a query                                   |
| `sendEvent(widgetId, properties?)` | Send a raw event to a widget by `$id`                               |
| `click(widget)`                    | Click a widget (Action, SubmitForm button)                          |
| `type(widget, text)`               | Type text into a TextField/PasswordField                            |
| `check(widget, value?)`            | Toggle a Checkbox (defaults to `true`)                              |
| `select(widget, value)`            | Select a Dropdown option                                            |
| `setNumber(widget, value)`         | Set a NumberField value                                             |
| `unmount()`                        | Unmount the component — always call at the end of each test         |
| `closedWith`                       | The string passed to `closeWidget()`, or `null`                     |

`widget` parameters accept either a `Widget` object (from `findWidget`) or a string `$id`.

### Query widgets

Use `findWidget` to locate widgets by property:

```ts
// By name (matches Form field `name` prop)
session.findWidget({ name: "password" });

// By title (matches Action/SubmitForm `title` prop)
session.findWidget({ title: "Done" });

// By type (with or without "widget:" prefix)
session.findWidget({ type: "checkbox" });

// By label
session.findWidget({ label: "Include numbers" });
```

### Reading widget properties

Widget properties are in `widget.properties`. Form field values are typically at `.properties.value` (not `.properties.checked` for checkboxes):

```ts
const field = session.findWidget({ name: "email" });
const value = String(field!.properties.value ?? "");
```

### Testing closeWidget

When a component calls `closeWidget(text)`, the session captures it:

```ts
await session.click(doneBtn!);
assert.equal(session.closedWith, "Expected close message");
```

### Pure Logic Tests

Test business logic (helpers, generators, parsers) separately without the widget framework:

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generatePassword } from "../components/generate-password.js";

describe("generatePassword", () => {
  it("generates password of requested length", () => {
    const password = generatePassword({
      length: 20,
      symbols: true,
      numbers: true,
    });
    assert.equal(password.length, 20);
  });
});
```

## Step 4: Run Tests

```bash
cd mcps/<mcp-name> && npm test
```

Fix any failures before proceeding.

## Step 5: Verify Build

Tests should not break the build. Confirm:

```bash
cd mcps/<mcp-name> && npm run build
```

## Common Issues

| Problem                               | Cause                                     | Fix                                                                                                               |
| ------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `Cannot find module 'node:test'`      | Missing `@types/node`                     | `npm i -D @types/node` and add to tsconfig `types`                                                                |
| Test files compiled to dist           | Tests not excluded from build             | Exclude `tests` directory in tsconfig or keep tests inside `tests/` which is naturally outside `rootDir` patterns |
| Widget `null` from `findWidget`       | Wrong query property                      | Check widget tree with `getSimplifiedState()` to see actual types and properties                                  |
| Checkbox value is `undefined`         | Using `.properties.checked`               | Use `.properties.value` instead — checkboxes serialize `checked` as `value` in the widget tree                    |
| `Detected multiple renderers` warning | React context warning from test isolation | Safe to ignore — does not affect test results                                                                     |
| Import errors in test files           | Missing `.js` extension                   | Use `.js` extensions for local imports (ESM requirement)                                                          |

## Test Checklist

- [ ] `@types/node` in devDependencies
- [ ] `@types/node` in tsconfig `types` array
- [ ] `"test"` script in package.json
- [ ] Test files in `tests/` directory
- [ ] Pure logic has unit tests
- [ ] Widget rendering tested with `createUIXTestSession`
- [ ] User interactions tested (click, type, check, select)
- [ ] `closeWidget` behavior tested
- [ ] `session.unmount()` called at end of every test
- [ ] `npm test` passes
- [ ] `npm run build` still passes
