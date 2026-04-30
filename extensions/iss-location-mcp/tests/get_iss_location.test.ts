import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import ISSWidget from "../components/get_iss_location.js";

describe("ISS location widget", () => {
  it("renders a form", async () => {
    const session = await createUIXTestSession(ISSWidget);
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has Refresh, Auto-refresh, and Done actions", async () => {
    const session = await createUIXTestSession(ISSWidget);

    assert.ok(session.findWidget({ title: "Refresh" }), "should have Refresh button");
    assert.ok(session.findWidget({ title: "Auto-refresh" }), "should have Auto-refresh button");
    assert.ok(session.findWidget({ title: "Done" }), "should have Done button");

    session.unmount();
  });
});
