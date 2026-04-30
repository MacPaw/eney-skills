import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import AdviceSlipWidget from "../components/get_advice.js";

describe("Advice slip widget", () => {
  it("renders a form", async () => {
    const session = await createUIXTestSession(AdviceSlipWidget);
    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");
    session.unmount();
  });

  it("has Another and Done actions", async () => {
    const session = await createUIXTestSession(AdviceSlipWidget);

    assert.ok(session.findWidget({ title: "Another" }), "Another button");
    assert.ok(session.findWidget({ title: "Done" }), "Done button");

    session.unmount();
  });
});
