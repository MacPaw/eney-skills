import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import GithubEmojiWidget from "../components/search_github_emoji.js";

describe("GitHub Emoji widget", () => {
  it("renders a form", async () => {
    const session = await createUIXTestSession(GithubEmojiWidget);
    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");
    session.unmount();
  });

  it("has Search, Copy all shortcodes, and Done", async () => {
    const session = await createUIXTestSession(GithubEmojiWidget);
    assert.ok(session.findWidget({ title: "Search" }), "Search button");
    assert.ok(session.findWidget({ title: "Copy all shortcodes" }), "Copy all button");
    assert.ok(session.findWidget({ title: "Done" }), "Done button");
    session.unmount();
  });
});
