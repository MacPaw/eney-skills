import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import TranslateWidget from "../components/translate_text.js";

describe("Translate widget", () => {
  it("renders a form when given text", async () => {
    const session = await createUIXTestSession(TranslateWidget, { text: "hello world" });
    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");
    session.unmount();
  });

  it("has Translate, Swap, language presets, and Done", async () => {
    const session = await createUIXTestSession(TranslateWidget, { text: "hi" });
    assert.ok(session.findWidget({ title: "Translate" }), "Translate button");
    assert.ok(session.findWidget({ title: "Swap" }), "Swap button");
    assert.ok(session.findWidget({ title: "English" }), "English preset");
    assert.ok(session.findWidget({ title: "Spanish" }), "Spanish preset");
    assert.ok(session.findWidget({ title: "Japanese" }), "Japanese preset");
    assert.ok(session.findWidget({ title: "Done" }), "Done button");
    session.unmount();
  });
});
