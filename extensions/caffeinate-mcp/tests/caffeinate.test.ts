import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import CaffeinateWidget from "../components/caffeinate.js";
import { fmtDuration } from "../helpers/caffeinate.js";

describe("Caffeinate widget", () => {
  it("renders a form", async () => {
    const session = await createUIXTestSession(CaffeinateWidget);
    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");
    session.unmount();
  });

  it("has Start, presets, mode buttons, Stop, and Done", async () => {
    const session = await createUIXTestSession(CaffeinateWidget);
    assert.ok(session.findWidget({ title: "Start" }), "Start button");
    assert.ok(session.findWidget({ title: "Indefinite" }), "Indefinite button");
    assert.ok(session.findWidget({ title: "Stop all" }), "Stop all button");
    assert.ok(session.findWidget({ title: "15 min" }), "15 min preset");
    assert.ok(session.findWidget({ title: "1 h" }), "1h preset");
    assert.ok(session.findWidget({ title: "system+display" }), "system+display mode");
    assert.ok(session.findWidget({ title: "Done" }), "Done button");
    session.unmount();
  });
});

describe("caffeinate helpers", () => {
  it("fmtDuration handles seconds, minutes, hours, indefinite", () => {
    assert.equal(fmtDuration(0), "indefinite");
    assert.equal(fmtDuration(45), "45s");
    assert.equal(fmtDuration(120), "2m");
    assert.equal(fmtDuration(3600), "1h");
    assert.equal(fmtDuration(3 * 3600 + 30 * 60), "3h 30m");
  });
});
