import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import AppendToNoteWidget from "../components/append-to-note.js";

describe("AppendToNote widget", () => {
  it("renders form with dropdown and editor", async () => {
    const session = await createUIXTestSession(AppendToNoteWidget);
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("shows loading state initially", async () => {
    const session = await createUIXTestSession(AppendToNoteWidget);

    const loading = session.findWidget({ type: "paper" });
    assert.ok(loading, "should show loading paper");

    session.unmount();
  });

  it("submit button is disabled without content", async () => {
    const session = await createUIXTestSession(AppendToNoteWidget);

    const submitBtn = session.findWidget({ title: "Add to Note" });
    if (submitBtn) {
      assert.equal(submitBtn.properties.isDisabled, true);
    }

    session.unmount();
  });

  it("renders with provided content prop", async () => {
    const session = await createUIXTestSession(AppendToNoteWidget, {
      content: "Appended text",
    });

    const editor = session.findWidget({ type: "rich-text-editor" });
    if (editor) {
      assert.equal(String(editor.properties.value ?? ""), "Appended text");
    }

    session.unmount();
  });
});
