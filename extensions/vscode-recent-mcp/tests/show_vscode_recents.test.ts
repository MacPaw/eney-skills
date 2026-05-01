import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import VsCodeRecentsWidget from "../components/show_vscode_recents.js";

describe("VS Code recents widget", () => {
  it("renders a form", async () => {
    const session = await createUIXTestSession(VsCodeRecentsWidget);
    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");
    session.unmount();
  });

  it("has Refresh, kind filters, Open first match, and Done", async () => {
    const session = await createUIXTestSession(VsCodeRecentsWidget);
    assert.ok(session.findWidget({ title: "Refresh" }), "Refresh button");
    assert.ok(session.findWidget({ title: "All" }), "All filter");
    assert.ok(session.findWidget({ title: "Workspaces" }), "Workspaces filter");
    assert.ok(session.findWidget({ title: "Folders" }), "Folders filter");
    assert.ok(session.findWidget({ title: "Files" }), "Files filter");
    assert.ok(session.findWidget({ title: "Open first match" }), "Open first match");
    assert.ok(session.findWidget({ title: "Done" }), "Done button");
    session.unmount();
  });
});
