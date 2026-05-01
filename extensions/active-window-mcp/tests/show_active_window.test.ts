import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import ActiveWindowWidgetDef from "../components/show_active_window.js";

describe("Active window widget", () => {
  it("renders a form", async () => {
    const session = await createUIXTestSession(ActiveWindowWidgetDef);
    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");
    session.unmount();
  });

  it("has Refresh, Activate app, app presets, and Done", async () => {
    const session = await createUIXTestSession(ActiveWindowWidgetDef);
    assert.ok(session.findWidget({ title: "Refresh" }), "Refresh button");
    assert.ok(session.findWidget({ title: "Activate app" }), "Activate app button");
    assert.ok(session.findWidget({ title: "Safari" }), "Safari preset");
    assert.ok(session.findWidget({ title: "Finder" }), "Finder preset");
    assert.ok(session.findWidget({ title: "Terminal" }), "Terminal preset");
    assert.ok(session.findWidget({ title: "Done" }), "Done button");
    session.unmount();
  });
});
