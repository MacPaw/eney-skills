import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import SetVolumeWidget from "../components/set-volume.js";

describe("SetVolume widget", () => {
  it("renders a form in loading state", async () => {
    const session = await createUIXTestSession(SetVolumeWidget);
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("renders with provided props", async () => {
    const session = await createUIXTestSession(SetVolumeWidget, { level: 50, muted: false });

    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has an Apply action", async () => {
    const session = await createUIXTestSession(SetVolumeWidget, { level: 50 });

    const submitBtn = session.findWidget({ title: "Apply" }) ?? session.findWidget({ title: "Applying..." });
    assert.ok(submitBtn, "should have an Apply button");

    session.unmount();
  });
});
