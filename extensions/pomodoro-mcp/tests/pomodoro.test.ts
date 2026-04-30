import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import PomodoroWidget from "../components/pomodoro.js";

describe("Pomodoro widget", () => {
  it("renders a form with default props", async () => {
    const session = await createUIXTestSession(PomodoroWidget);
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has Start, Skip, Reset, and Done actions", async () => {
    const session = await createUIXTestSession(PomodoroWidget);

    assert.ok(session.findWidget({ title: "Start" }), "should have a Start button");
    assert.ok(session.findWidget({ title: "Skip" }), "should have a Skip button");
    assert.ok(session.findWidget({ title: "Reset" }), "should have a Reset button");
    assert.ok(session.findWidget({ title: "Done" }), "should have a Done button");

    session.unmount();
  });
});
