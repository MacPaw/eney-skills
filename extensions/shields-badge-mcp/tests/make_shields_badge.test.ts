import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import ShieldsBadgeWidget from "../components/make_shields_badge.js";

describe("Shields badge widget", () => {
  it("renders a form with required props", async () => {
    const session = await createUIXTestSession(ShieldsBadgeWidget, {
      label: "build",
      message: "passing",
    });
    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");
    session.unmount();
  });

  it("has Apply, color presets, style presets, and Done", async () => {
    const session = await createUIXTestSession(ShieldsBadgeWidget, {
      label: "label",
      message: "msg",
    });

    assert.ok(session.findWidget({ title: "Apply" }), "Apply button");
    assert.ok(session.findWidget({ title: "blue" }), "blue preset");
    assert.ok(session.findWidget({ title: "for-the-badge" }), "for-the-badge style");
    assert.ok(session.findWidget({ title: "Done" }), "Done button");

    session.unmount();
  });

  it("escapes hyphens in label/message per shields.io rules", async () => {
    const session = await createUIXTestSession(ShieldsBadgeWidget, {
      label: "node-version",
      message: "20.x",
    });
    const dump = JSON.stringify(session.getSimplifiedState());
    // shields.io needs hyphens doubled inside the path segments
    assert.ok(/node--version/.test(dump), "label hyphens should be doubled");
    session.unmount();
  });

  it("includes for-the-badge style param when selected", async () => {
    const session = await createUIXTestSession(ShieldsBadgeWidget, {
      label: "ci",
      message: "passing",
      style: "for-the-badge",
    });
    const dump = JSON.stringify(session.getSimplifiedState());
    assert.ok(/style=for-the-badge/.test(dump), "URL should include style=for-the-badge");
    session.unmount();
  });
});
