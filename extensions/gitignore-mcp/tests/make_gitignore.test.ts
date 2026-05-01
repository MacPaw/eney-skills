import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import GitignoreWidget from "../components/make_gitignore.js";

describe("Gitignore widget", () => {
  it("renders a form when given stacks", async () => {
    const session = await createUIXTestSession(GitignoreWidget, { stacks: "node,macos" });
    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");
    session.unmount();
  });

  it("has Generate, presets, List stacks, and Done", async () => {
    const session = await createUIXTestSession(GitignoreWidget, { stacks: "node" });
    assert.ok(session.findWidget({ title: "Generate" }), "Generate button");
    assert.ok(session.findWidget({ title: "Node + macOS" }), "Node + macOS preset");
    assert.ok(session.findWidget({ title: "Python + macOS" }), "Python + macOS preset");
    assert.ok(session.findWidget({ title: "List stacks" }), "List stacks button");
    assert.ok(session.findWidget({ title: "Done" }), "Done button");
    session.unmount();
  });
});
