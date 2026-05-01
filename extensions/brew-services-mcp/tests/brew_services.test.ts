import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import BrewServicesWidget from "../components/brew_services.js";
import { findBrew, controlService } from "../helpers/brew.js";

describe("Brew services widget", () => {
  it("renders a form", async () => {
    const session = await createUIXTestSession(BrewServicesWidget);
    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");
    session.unmount();
  });

  it("has Refresh, action buttons, and Done", async () => {
    const session = await createUIXTestSession(BrewServicesWidget);
    assert.ok(session.findWidget({ title: "Refresh" }), "Refresh button");
    assert.ok(session.findWidget({ title: "Start" }), "Start button");
    assert.ok(session.findWidget({ title: "Stop" }), "Stop button");
    assert.ok(session.findWidget({ title: "Restart" }), "Restart button");
    assert.ok(session.findWidget({ title: "Run (one-shot)" }), "Run button");
    assert.ok(session.findWidget({ title: "Done" }), "Done button");
    session.unmount();
  });
});

describe("brew helpers", () => {
  it("findBrew either returns a string path or null", () => {
    const r = findBrew();
    assert.ok(r === null || typeof r === "string");
  });

  it("controlService rejects suspicious service names", async () => {
    await assert.rejects(
      () => controlService("foo; rm -rf /", "start"),
      /suspicious service name/i,
    );
    await assert.rejects(
      () => controlService("$(whoami)", "start"),
      /suspicious service name/i,
    );
  });
});
