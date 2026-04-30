import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import EmojiSearchWidget from "../components/search_emoji.js";

describe("Emoji search widget", () => {
  it("renders a form", async () => {
    const session = await createUIXTestSession(EmojiSearchWidget);
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has Search, Random, Copy All, and Done actions", async () => {
    const session = await createUIXTestSession(EmojiSearchWidget);

    assert.ok(session.findWidget({ title: "Search" }), "should have Search button");
    assert.ok(session.findWidget({ title: "Random" }), "should have Random button");
    assert.ok(session.findWidget({ title: "Copy All" }), "should have Copy All button");
    assert.ok(session.findWidget({ title: "Done" }), "should have Done button");

    session.unmount();
  });
});
