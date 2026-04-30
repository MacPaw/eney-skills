import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import QuotableWidget from "../components/get_random_quote.js";

describe("Quotable widget", () => {
  it("renders a form", async () => {
    const session = await createUIXTestSession(QuotableWidget);
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has Another and Done actions", async () => {
    const session = await createUIXTestSession(QuotableWidget);

    assert.ok(session.findWidget({ title: "Another" }), "should have Another button");
    assert.ok(session.findWidget({ title: "Done" }), "should have Done button");

    session.unmount();
  });
});
