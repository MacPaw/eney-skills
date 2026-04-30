import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import StopwatchWidget from "../components/stopwatch.js";

describe("Stopwatch widget", () => {
  it("renders a form with default props", async () => {
    const session = await createUIXTestSession(StopwatchWidget);
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has Start and Done actions", async () => {
    const session = await createUIXTestSession(StopwatchWidget);

    const startBtn = session.findWidget({ title: "Start" });
    assert.ok(startBtn, "should have a Start button");

    const doneBtn = session.findWidget({ title: "Done" });
    assert.ok(doneBtn, "should have a Done button");

    session.unmount();
  });
});
