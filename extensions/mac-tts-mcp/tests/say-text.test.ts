import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import SayTextWidget from "../components/say-text.js";

describe("SayText widget", () => {
  it("renders a form with default props", async () => {
    const session = await createUIXTestSession(SayTextWidget);
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("renders with provided props", async () => {
    const session = await createUIXTestSession(SayTextWidget, {
      text: "Hello world",
      voice: "Samantha",
      rate: 200,
    });

    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has a Speak action", async () => {
    const session = await createUIXTestSession(SayTextWidget, { text: "Hello" });

    const submitBtn = session.findWidget({ title: "Speak" }) ?? session.findWidget({ title: "Speaking..." });
    assert.ok(submitBtn, "should have a Speak button");

    session.unmount();
  });
});
