import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import SearchHomebrewWidget from "../components/search-homebrew.js";

describe("SearchHomebrew widget", () => {
  it("renders a form with default props", async () => {
    const session = await createUIXTestSession(SearchHomebrewWidget);
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("renders with provided query prop", async () => {
    const session = await createUIXTestSession(SearchHomebrewWidget, { query: "node" });

    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has a Search action", async () => {
    const session = await createUIXTestSession(SearchHomebrewWidget, { query: "node" });

    const submitBtn = session.findWidget({ title: "Search" }) ?? session.findWidget({ title: "Searching..." });
    assert.ok(submitBtn, "should have a Search button");

    session.unmount();
  });
});
