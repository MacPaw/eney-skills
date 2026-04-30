import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import WikipediaWidget from "../components/wikipedia_summary.js";

describe("Wikipedia widget", () => {
  it("renders a form", async () => {
    const session = await createUIXTestSession(WikipediaWidget, { query: "Albert Einstein" });
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has Search and Done actions", async () => {
    const session = await createUIXTestSession(WikipediaWidget, { query: "Pasta" });

    assert.ok(session.findWidget({ title: "Search" }), "should have a Search button");
    assert.ok(session.findWidget({ title: "Done" }), "should have a Done button");

    session.unmount();
  });
});
