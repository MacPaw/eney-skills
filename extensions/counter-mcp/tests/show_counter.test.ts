import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import CounterWidget from "../components/show_counter.js";

describe("Counter widget", () => {
  it("renders a form", async () => {
    const session = await createUIXTestSession(CounterWidget);
    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");
    session.unmount();
  });

  it("has +N, -N, Undo, Reset, Done", async () => {
    const session = await createUIXTestSession(CounterWidget, { step: 1 });
    assert.ok(session.findWidget({ title: "+1" }), "+1 button");
    assert.ok(session.findWidget({ title: "-1" }), "-1 button");
    assert.ok(session.findWidget({ title: "Undo" }), "Undo button");
    assert.ok(session.findWidget({ title: "Reset" }), "Reset button");
    assert.ok(session.findWidget({ title: "Done" }), "Done button");
    session.unmount();
  });

  it("respects custom step in button labels", async () => {
    const session = await createUIXTestSession(CounterWidget, { step: 5 });
    assert.ok(session.findWidget({ title: "+5" }), "+5 button");
    assert.ok(session.findWidget({ title: "-5" }), "-5 button");
    session.unmount();
  });
});
