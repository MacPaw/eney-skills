import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import OnThisDayWidget from "../components/on_this_day.js";

describe("On This Day widget", () => {
  it("renders a form", async () => {
    const session = await createUIXTestSession(OnThisDayWidget);
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has Look Up, type filter buttons, and Done", async () => {
    const session = await createUIXTestSession(OnThisDayWidget);

    assert.ok(session.findWidget({ title: "Look Up" }), "should have Look Up button");
    assert.ok(session.findWidget({ title: "Events" }), "should have Events filter");
    assert.ok(session.findWidget({ title: "Births" }), "should have Births filter");
    assert.ok(session.findWidget({ title: "Deaths" }), "should have Deaths filter");
    assert.ok(session.findWidget({ title: "Holidays" }), "should have Holidays filter");
    assert.ok(session.findWidget({ title: "All" }), "should have All filter");
    assert.ok(session.findWidget({ title: "Done" }), "should have Done button");

    session.unmount();
  });
});
