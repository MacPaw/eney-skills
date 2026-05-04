import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import LaunchAppWidget from "../components/launch-app.js";

describe("LaunchApp widget", () => {
  it("renders a form in loading state", async () => {
    const session = await createUIXTestSession(LaunchAppWidget);
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has a Launch action", async () => {
    const session = await createUIXTestSession(LaunchAppWidget);

    const submitBtn = session.findWidget({ title: "Launch" }) ?? session.findWidget({ title: "Launching..." });
    assert.ok(submitBtn, "should have a Launch button");

    session.unmount();
  });
});
