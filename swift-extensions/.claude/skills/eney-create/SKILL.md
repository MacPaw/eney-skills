---
name: eney-create
description: Create a new Swift MCP skill with UIX widgets — scaffold the target, implement widgets, and wire up the server.
metadata:
  author: macpaw
  version: "1.0"
---

# Create a New Swift MCP Skill

Swift MCP skills are executable targets that use the UIX widget framework and communicate over stdio via the Model Context Protocol. Each skill lives as an `executableTarget` in `Package.swift` with its source files under `Sources/<target-name>/`.

## Step 1: Gather Requirements

Ask the user for (skip what's already provided):

- **Target Name** — kebab-case (e.g., `color-converter-mcp-server`)
- **Server Name** — for MCP identification (e.g., `color-converter-swift-mcp`)
- **Widget(s)** — for each widget:
  - **Widget Name** — kebab-case, used in `defineWidget` (e.g., `convert-color`)
  - **Widget Description** — used by LLM to select the tool (e.g., "Convert colors between HEX, RGB, and HSL")
  - **Input Fields** — name, type (`string`/`number`/`boolean`), description for each
  - **UI Components** — what the widget should display (forms, actions, etc.)

## Step 2: Add the Target to Package.swift

Add a new `executableTarget` to `Package.swift`:

```swift
.executableTarget(
    name: "<target-name>",
    dependencies: [
        "UIX",
        "UIXMCP",
        .product(name: "MCP", package: "swift-sdk"),
    ]
),
```

Create the source directory:

```bash
mkdir -p Sources/<target-name>
```

## Step 3: Implement the Widget(s)

Create `Sources/<target-name>/<WidgetName>Widget.swift` for each widget.

### Widget File Template

```swift
import Foundation
import UIX

struct <WidgetName>Widget: Widget {
    // Parse initial values from MCP tool call parameters
    init(properties: [String: PropertyValue] = [:]) {
        // e.g. self.initialValue = properties["param"]?.stringValue ?? "default"
    }

    func body(_ ctx: Context) -> some ComponentProtocol {
        // 1. Create reactive state bindings
        let myState = ctx.state("initial")

        // 2. Define actions
        let actions = ActionPanel(layout: .row) {
            Action(title: "Submit", style: .primary) {
                ctx.closeWidget(context: "Result: \(myState.value)")
            }
        }

        // 3. Build component tree
        return Form(actions: actions) {
            TextField(
                name: "field",
                value: myState.value,
                label: "Label",
                onChange: { val in myState.value = val }
            )
        }
    }
}

// MARK: - Widget Definition

let <widgetName>Definition = defineWidget(
    name: "<widget-name>",
    description: "<widget description for LLM>",
    schema: InputSchema {
        InputSchema.Field(name: "param", type: .string, description: "Description")
    },
    factory: { props in <WidgetName>Widget(properties: props) }
)
```

### Key Patterns

- **State** — `ctx.state(initialValue)` returns a `Binding<T>` with `.value` getter/setter
- **Close widget** — `ctx.closeWidget(context: "message")` signals completion to the LLM
- **Actions** — `ActionPanel` with `Action`, `CopyToClipboard`, `ShowInFinder`, `SubmitForm`
- **Schema** — `InputSchema` with `Field(name:type:description:)`, types are `.string`, `.number`, `.boolean`
- **Properties** — `PropertyValue` has `.stringValue`, `.intValue`, `.boolValue`, `.doubleValue` accessors

### Available UIX Components

| Category | Components |
|----------|-----------|
| **Form & Input** | `Form`, `TextField`, `PasswordField`, `NumberField`, `DatePicker`, `Dropdown`, `Checkbox`, `FilePicker`, `RichTextEditor` |
| **Layout** | `Card`, `CardHeader`, `Paper`, `ActionPanel` |
| **Actions** | `Action`, `SubmitForm`, `CopyToClipboard`, `ShowInFinder`, `Button` |
| **Display** | `Text`, `Files` |

Common component props:
- `TextField(name:value:label:isCopyable:onChange:)`
- `NumberField(name:value:label:min:max:onChange:)`
- `Checkbox(name:label:checked:variant:onChange:)` — variant: `.checkbox` or `.switch`
- `Dropdown(name:value:label:searchable:onChange:)` with `Dropdown.Item(value:title:)`
- `FilePicker(name:value:label:accept:multiple:onChange:)`
- `DatePicker(name:value:label:type:onChange:)` — type: `.date`, `.time`, `.dateTime`
- `Paper(markdown:)` — renders markdown text
- `Action(title:style:action:)` — style: `.primary`, `.secondary`
- `CopyToClipboard(content:title:)`

## Step 4: Create the Server Entry Point

Create `Sources/<target-name>/main.swift`:

```swift
import Foundation
import MCP
import UIX
import UIXMCP

let server = Server(
    name: "<server-name>",
    version: "1.0.0",
    capabilities: .init(
        logging: .init(),
        resources: .init(),
        tools: .init(listChanged: false)
    )
)

// MARK: - Widget Registration

let uix = UIXToolProvider()

await uix.register(<widgetName>Definition)
// Register additional widgets here

await uix.setOnWidgetTreeUpdated { json in
    try? await server.log(
        level: .info,
        data: .object(["message": .string(json)])
    )
}

await uix.setOnClose { json in
    try? await server.log(
        level: .info,
        data: .object(["message": .string(json)])
    )
}

await uix.start()

// MARK: - MCP Handlers

await server.withMethodHandler(ListTools.self) { _ in
    let widgetTools = await uix.tools()
    return ListTools.Result(tools: widgetTools)
}

await server.withMethodHandler(CallTool.self) { params in
    if let result = try await uix.handle(params) {
        return result
    }
    return CallTool.Result(
        content: [.text("Unknown tool: \(params.name)")],
        isError: true
    )
}

await server.withMethodHandler(ListResources.self) { _ in
    ListResources.Result(resources: [await uix.resource()])
}

await server.withMethodHandler(ReadResource.self) { params in
    let json = await uix.readResource()
    return ReadResource.Result(contents: [
        .text(json, uri: params.uri, mimeType: "application/json")
    ])
}

await server.withMethodHandler(SetLoggingLevel.self) { _ in
    Empty()
}

// MARK: - Start

let transport = StdioTransport()
try await server.start(transport: transport)
await server.waitUntilCompleted()
```

## Step 5: Build & Verify

```bash
swift build --target <target-name>
```

Fix any compiler errors before proceeding.

## Reference: Existing MCP Servers

Study these in the repo for real-world patterns:

- `Sources/new-password-mcp-server/` — single widget with NumberField, Checkbox, TextField, state-driven regeneration
- `Sources/pdf-mcp-server/` — multi-widget server (ImagesToPDF + SplitPages), FilePicker usage
