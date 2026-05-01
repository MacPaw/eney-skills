import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import TldrWidget from "../components/show_tldr.js";

describe("TLDR widget", () => {
  it("renders a form when given a command", async () => {
    const session = await createUIXTestSession(TldrWidget, { command: "curl" });
    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");
    session.unmount();
  });

  it("has Look Up, platform buttons, and Done", async () => {
    const session = await createUIXTestSession(TldrWidget, { command: "curl" });
    assert.ok(session.findWidget({ title: "Look Up" }), "Look Up button");
    assert.ok(session.findWidget({ title: "osx" }), "osx button");
    assert.ok(session.findWidget({ title: "linux" }), "linux button");
    assert.ok(session.findWidget({ title: "common" }), "common button");
    assert.ok(session.findWidget({ title: "Done" }), "Done button");
    session.unmount();
  });
});
