import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import KanyeWidget from "../components/get_kanye_quote.js";

describe("Kanye quote widget", () => {
  it("renders a form", async () => {
    const session = await createUIXTestSession(KanyeWidget);
    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");
    session.unmount();
  });

  it("has Another and Done actions", async () => {
    const session = await createUIXTestSession(KanyeWidget);
    assert.ok(session.findWidget({ title: "Another" }), "Another button");
    assert.ok(session.findWidget({ title: "Done" }), "Done button");
    session.unmount();
  });
});
