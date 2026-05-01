import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import StackOverflowWidget from "../components/search_stackoverflow.js";

describe("Stack Overflow widget", () => {
  it("renders a form when given a query", async () => {
    const session = await createUIXTestSession(StackOverflowWidget, { query: "async await" });
    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");
    session.unmount();
  });

  it("has Search, sort buttons, and Done", async () => {
    const session = await createUIXTestSession(StackOverflowWidget, { query: "react" });
    assert.ok(session.findWidget({ title: "Search" }), "Search button");
    assert.ok(session.findWidget({ title: "Relevance" }), "Relevance sort");
    assert.ok(session.findWidget({ title: "Votes" }), "Votes sort");
    assert.ok(session.findWidget({ title: "Activity" }), "Activity sort");
    assert.ok(session.findWidget({ title: "Newest" }), "Newest sort");
    assert.ok(session.findWidget({ title: "Done" }), "Done button");
    session.unmount();
  });
});
