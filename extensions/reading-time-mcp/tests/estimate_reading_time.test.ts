import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import ReadingTimeWidget from "../components/estimate_reading_time.js";

describe("Reading time widget", () => {
  it("renders a form with provided text", async () => {
    const session = await createUIXTestSession(ReadingTimeWidget, {
      text: "Hello world. This is a test.",
    });
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has Analyze and Done actions", async () => {
    const session = await createUIXTestSession(ReadingTimeWidget, {
      text: "Some text.",
    });

    assert.ok(session.findWidget({ title: "Analyze" }), "should have Analyze button");
    assert.ok(session.findWidget({ title: "Done" }), "should have Done button");

    session.unmount();
  });

  it("counts words correctly for medium text", async () => {
    // 250 words at 238 wpm should produce ~1 min reading time
    const text = ("word ").repeat(250).trim();
    const session = await createUIXTestSession(ReadingTimeWidget, { text });
    const dump = JSON.stringify(session.getSimplifiedState());
    assert.ok(/250/.test(dump), "output should mention 250 words");
    session.unmount();
  });
});
