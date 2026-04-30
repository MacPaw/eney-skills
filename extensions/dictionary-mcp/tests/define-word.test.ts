import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUIXTestSession } from "@eney/api/testing";
import DefineWordWidget from "../components/define-word.js";

describe("DefineWord widget", () => {
  it("renders a form with default props", async () => {
    const session = await createUIXTestSession(DefineWordWidget);
    const state = session.getSimplifiedState();

    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("renders with provided props", async () => {
    const session = await createUIXTestSession(DefineWordWidget, { word: "etymology" });

    const state = session.getSimplifiedState();
    const form = state.children?.find((c) => c.type === "form");
    assert.ok(form, "should render a form");

    session.unmount();
  });

  it("has a Define action", async () => {
    const session = await createUIXTestSession(DefineWordWidget, { word: "etymology" });

    const submitBtn = session.findWidget({ title: "Define" }) ?? session.findWidget({ title: "Looking up..." });
    assert.ok(submitBtn, "should have a Define button");

    session.unmount();
  });
});
