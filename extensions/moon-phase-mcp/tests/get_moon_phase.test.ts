import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import MoonPhaseWidget from "../components/get_moon_phase.js";

describe("Moon phase widget", () => {
  it("renders a form", async () => {
    const session = await createUIXTestSession(MoonPhaseWidget);
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has Compute, Today, and Done actions", async () => {
    const session = await createUIXTestSession(MoonPhaseWidget);

    assert.ok(session.findWidget({ title: "Compute" }), "should have Compute button");
    assert.ok(session.findWidget({ title: "Today" }), "should have Today button");
    assert.ok(session.findWidget({ title: "Done" }), "should have Done button");

    session.unmount();
  });

  it("renders correctly for a known full moon date", async () => {
    // 2024-09-18 was a full moon (within ±1 day tolerance)
    const session = await createUIXTestSession(MoonPhaseWidget, { date: "2024-09-18" });
    const state = session.getSimplifiedState();
    const dump = JSON.stringify(state);
    assert.ok(/Full moon|Waxing gibbous|Waning gibbous/.test(dump), "should be near full moon");
    session.unmount();
  });
});
