import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import WordToolsWidget from "../components/find_words.js";

describe("Datamuse word tools widget", () => {
  it("renders a form when given a word", async () => {
    const session = await createUIXTestSession(WordToolsWidget, { word: "happy" });
    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");
    session.unmount();
  });

  it("has Look Up, mode buttons, and Done", async () => {
    const session = await createUIXTestSession(WordToolsWidget, { word: "happy" });
    assert.ok(session.findWidget({ title: "Look Up" }), "Look Up button");
    assert.ok(session.findWidget({ title: "Synonyms" }), "Synonyms button");
    assert.ok(session.findWidget({ title: "Antonyms" }), "Antonyms button");
    assert.ok(session.findWidget({ title: "Rhymes" }), "Rhymes button");
    assert.ok(session.findWidget({ title: "Near rhymes" }), "Near rhymes button");
    assert.ok(session.findWidget({ title: "Related" }), "Related button");
    assert.ok(session.findWidget({ title: "Homophones" }), "Homophones button");
    assert.ok(session.findWidget({ title: "Done" }), "Done button");
    session.unmount();
  });
});
