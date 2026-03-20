import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import CreateNoteWidget from "../components/create-note.js";

describe("CreateNote widget", () => {
  it("renders form in loading state", async () => {
    const session = await createUIXTestSession(CreateNoteWidget);
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    const loading = session.findWidget({ type: "paper" });
    assert.ok(loading, "should show loading indicator");

    session.unmount();
  });

  it("renders with provided props", async () => {
    const session = await createUIXTestSession(CreateNoteWidget, {
      name: "Test Note",
      content: "Some content",
    });

    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has a submit action", async () => {
    const session = await createUIXTestSession(CreateNoteWidget);

    const submitBtn = session.findWidget({ title: "Create Note" }) ?? session.findWidget({ title: "Creating..." });
    assert.ok(submitBtn, "should have a submit button");

    session.unmount();
  });
});
